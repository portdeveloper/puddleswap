#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";

const DEFAULT_BROADCAST_FILE = "contracts/broadcast/DeployDexCore.s.sol/10143/dry-run/run-latest.json";

function required(value, label) {
  if (!value) {
    throw new Error(`Missing required env var: ${label}`);
  }
  return value;
}

function loadWalletFromKeystore() {
  const accountName = process.env.KEYSTORE_ACCOUNT ?? "claude-monad";
  const keystorePath = process.env.KEYSTORE_PATH ?? path.join(process.env.HOME, ".foundry/keystores", accountName);
  const passwordFile =
    process.env.KEYSTORE_PASSWORD_FILE ?? path.join(process.env.HOME, ".monad-keystore-password");

  const keystoreJson = fs.readFileSync(keystorePath, "utf8");
  const password = fs.readFileSync(passwordFile, "utf8").trim();
  return ethers.Wallet.fromEncryptedJsonSync(keystoreJson, password);
}

function extractProposals(broadcastFile, createCallAddress) {
  const payload = JSON.parse(fs.readFileSync(broadcastFile, "utf8"));
  const txs = payload.transactions ?? [];

  const createCallInterface = new ethers.Interface([
    "function performCreate(uint256 value, bytes deploymentData) returns (address newContract)"
  ]);

  const proposals = [];

  for (const tx of txs) {
    const txType = tx.transactionType;
    const txData = tx.transaction ?? {};

    if (txType === "CREATE" && txData.input) {
      proposals.push({
        type: "create",
        to: createCallAddress,
        value: 0n,
        data: createCallInterface.encodeFunctionData("performCreate", [0, txData.input]),
        operation: 1
      });
      continue;
    }

    if (txType === "CALL" && txData.to) {
      proposals.push({
        type: "call",
        to: ethers.getAddress(txData.to),
        value: BigInt(txData.value ?? "0"),
        data: txData.input ?? "0x",
        operation: 0
      });
    }
  }

  return proposals;
}

async function main() {
  const safeAddress = ethers.getAddress(required(process.env.SAFE_ADDRESS, "SAFE_ADDRESS"));
  const chainId = Number(process.env.CHAIN_ID ?? "10143");
  const rpcUrl = process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz";
  const txServiceUrl = process.env.SAFE_TX_SERVICE_URL ?? "https://api.safe.global/tx-service/monad-testnet/api/v1";
  const createCallAddress = ethers.getAddress(
    process.env.SAFE_CREATE_CALL ?? "0x9b35Af71d77eaf8d7e40252370304687390A1A52"
  );
  const broadcastFile = process.env.BROADCAST_FILE ?? DEFAULT_BROADCAST_FILE;

  const proposals = extractProposals(broadcastFile, createCallAddress);
  if (proposals.length === 0) {
    throw new Error(`No supported transactions (CREATE/CALL) found in ${broadcastFile}`);
  }

  const wallet = loadWalletFromKeystore();
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = wallet.connect(provider);

  const safeAbi = [
    "function nonce() view returns (uint256)",
    "function getTransactionHash(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce) view returns (bytes32)"
  ];
  const safe = new ethers.Contract(safeAddress, safeAbi, provider);

  const domain = {
    chainId,
    verifyingContract: safeAddress
  };

  const types = {
    SafeTx: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" },
      { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" },
      { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" },
      { name: "nonce", type: "uint256" }
    ]
  };

  const zeroAddress = "0x0000000000000000000000000000000000000000";
  let nextNonce = await safe.nonce();

  for (let index = 0; index < proposals.length; index += 1) {
    const proposal = proposals[index];
    const txData = {
      to: proposal.to,
      value: proposal.value,
      data: proposal.data,
      operation: proposal.operation,
      safeTxGas: 0n,
      baseGas: 0n,
      gasPrice: 0n,
      gasToken: zeroAddress,
      refundReceiver: zeroAddress,
      nonce: nextNonce
    };

    const contractTransactionHash = await safe.getTransactionHash(
      txData.to,
      txData.value,
      txData.data,
      txData.operation,
      txData.safeTxGas,
      txData.baseGas,
      txData.gasPrice,
      txData.gasToken,
      txData.refundReceiver,
      txData.nonce
    );

    const signature = await signer.signTypedData(domain, types, txData);

    const body = {
      safe: safeAddress,
      to: txData.to,
      value: txData.value.toString(),
      data: txData.data,
      operation: txData.operation,
      safeTxGas: txData.safeTxGas.toString(),
      baseGas: txData.baseGas.toString(),
      gasPrice: txData.gasPrice.toString(),
      gasToken: txData.gasToken,
      refundReceiver: txData.refundReceiver,
      nonce: txData.nonce.toString(),
      contractTransactionHash,
      sender: signer.address,
      signature,
      origin: `port-swap:${proposal.type}-${index + 1}`
    };

    const headers = {
      "Content-Type": "application/json"
    };

    if (process.env.SAFE_API_KEY) {
      headers.Authorization = `Bearer ${process.env.SAFE_API_KEY}`;
    }

    const response = await fetch(`${txServiceUrl}/safes/${safeAddress}/multisig-transactions/`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Failed to propose tx ${index + 1}: ${response.status} ${responseText}`);
    }

    console.log(
      `Proposed ${proposal.type.toUpperCase()} tx ${index + 1} with nonce ${nextNonce.toString()}`
    );
    nextNonce += 1n;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
