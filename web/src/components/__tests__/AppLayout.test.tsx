import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AppLayout } from "../AppLayout";

vi.mock("../AnimatedBackground", () => ({
  AnimatedBackground: () => null,
}));

vi.mock("../BelowFold", () => ({
  BelowFold: () => null,
}));

function renderLayout(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppLayout>
        <div>Route content</div>
      </AppLayout>
    </MemoryRouter>,
  );
}

describe("AppLayout navigation", () => {
  it("keeps Learn and app links in the primary navbar on learn routes", () => {
    renderLayout("/learn/star-routing");

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const navLinks = within(nav).getAllByRole("link");

    expect(navLinks.map((link) => link.textContent)).toEqual([
      "puddleswap",
      "Swap",
      "Learn",
      "Tokens",
      "Pools",
      "Open Swap",
    ]);
    expect(within(nav).getByRole("link", { name: "Learn" })).toHaveClass(
      "active",
    );
  });

  it("keeps the same primary links after clicking Learn", async () => {
    const user = userEvent.setup();
    renderLayout("/");

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const originalLabels = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent);

    await user.click(within(nav).getByRole("link", { name: "Learn" }));

    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(originalLabels);
    expect(within(nav).getByRole("link", { name: "Learn" })).toHaveClass(
      "active",
    );
  });
});
