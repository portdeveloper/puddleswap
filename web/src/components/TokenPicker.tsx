import { useState } from "react";
import type { Address } from "viem";

import { useRegistrySearch } from "../hooks/useRegistrySearch";

type TokenPickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (token: Address) => void;
};

export function TokenPicker({ label, value, onChange, onSelect }: TokenPickerProps) {
  const [query, setQuery] = useState("");
  const { data: results = [], isFetching } = useRegistrySearch(query);

  return (
    <section className="token-picker">
      <label>
        {label}
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="0x..." />
      </label>

      <label>
        Search registry
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value.slice(0, 4))}
          placeholder="symbol prefix"
        />
      </label>

      <div className="token-results">
        {isFetching && <small>Searching...</small>}
        {results.map((token) => (
          <button
            key={token.token}
            type="button"
            className="token-chip"
            onClick={() => {
              onChange(token.token);
              onSelect?.(token.token);
            }}
          >
            <span>{token.symbol}</span>
            <small>{token.name}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
