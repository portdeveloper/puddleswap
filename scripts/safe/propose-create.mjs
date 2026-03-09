#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";

function required(value, key) {
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
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

async function main() {
  const safeAddress = ethers.getAddress(required(process.env.SAFE_ADDRESS, "SAFE_ADDRESS"));
  const rpcUrl = process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz";
  const chainId = Number(process.env.CHAIN_ID ?? "10143");
  const txServiceUrl = process.env.SAFE_TX_SERVICE_URL ?? "https://api.safe.global/tx-service/monad-testnet/api/v1";
  const createCallAddress = ethers.getAddress(
    process.env.SAFE_CREATE_CALL ?? "0x9b35Af71d77eaf8d7e40252370304687390A1A52"
  );

  const deploymentBytecode = required(process.env.DEPLOYMENT_BYTECODE, "DEPLOYMENT_BYTECODE");
  const origin = process.env.SAFE_ORIGIN ?? "port-swap:create";

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = loadWalletFromKeystore().connect(provider);

  const safeAbi = [
    "function nonce() view returns (uint256)",
    "function getTransactionHash(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce) view returns (bytes32)"
  ];
  const safe = new ethers.Contract(safeAddress, safeAbi, provider);

  const createCallInterface = new ethers.Interface([
    "function performCreate(uint256 value, bytes deploymentData) returns (address newContract)"
  ]);

  const nonce = await safe.nonce();
  const zeroAddress = "0x0000000000000000000000000000000000000000";

  const data = createCallInterface.encodeFunctionData("performCreate", [0, deploymentBytecode]);

  const txData = {
    to: createCallAddress,
    value: 0n,
    data,
    operation: 1,
    safeTxGas: 0n,
    baseGas: 0n,
    gasPrice: 0n,
    gasToken: zeroAddress,
    refundReceiver: zeroAddress,
    nonce
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

  const signature = await wallet.signTypedData(domain, types, txData);

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
    sender: wallet.address,
    signature,
    origin
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
    throw new Error(`Failed to propose tx: ${response.status} ${responseText}`);
  }

  console.log(`Proposed create tx with nonce ${nonce.toString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
