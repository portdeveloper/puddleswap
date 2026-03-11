import { monadTestnet } from "../config/chain";

const TX_HASH_RE = /\b(0x[0-9a-fA-F]{64})\b/;

export function TxStatus({ message, className }: { message: string; className?: string }) {
  const explorerUrl = monadTestnet.blockExplorers.default.url;
  const match = message.match(TX_HASH_RE);

  if (!match) {
    return <p className={className}>{message}</p>;
  }

  const hash = match[1];
  const before = message.slice(0, match.index);
  const after = message.slice(match.index! + hash.length);
  const shortHash = `${hash.slice(0, 6)}...${hash.slice(-4)}`;

  return (
    <p className={className}>
      {before}
      <a href={`${explorerUrl}/tx/${hash}`} target="_blank" rel="noopener noreferrer">
        {shortHash}
      </a>
      {after}
    </p>
  );
}
