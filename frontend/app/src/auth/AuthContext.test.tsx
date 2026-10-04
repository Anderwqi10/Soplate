import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "../api/client";
import { AuthProvider, useAuth } from "./AuthContext";

function LogoutButton() {
  const { logout } = useAuth();
  return <button onClick={logout}>Salir</button>;
}

function setup() {
  const client = new QueryClient();
  client.setQueryData(["accounts"], [{ id: 1, name: "Cuenta de la persona anterior" }]);
  tokenStore.set("A1", "R1");
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <LogoutButton />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return client;
}

test("logout clears cached data so the next user never sees it", async () => {
  const client = setup();
  await userEvent.click(screen.getByRole("button", { name: "Salir" }));
  expect(client.getQueryData(["accounts"])).toBeUndefined();
  expect(tokenStore.get().access).toBeNull();
});

test("expired session also clears cached data", () => {
  const client = setup();
  act(() => {
    window.dispatchEvent(new Event("soplate:logout"));
  });
  expect(client.getQueryData(["accounts"])).toBeUndefined();
});
