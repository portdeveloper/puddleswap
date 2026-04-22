import "@testing-library/jest-dom";
import { vi } from "vitest";

vi.mock("react-helmet-async", () => ({
  Helmet: () => null,
  HelmetProvider: ({ children }: { children: unknown }) => children,
}));
