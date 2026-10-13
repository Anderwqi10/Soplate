import { apiUrlFor } from "./config";

test("served by Django, the API lives on the same origin", () => {
  expect(
    apiUrlFor({ protocol: "https:", hostname: "pc.tail.ts.net", port: "", origin: "https://pc.tail.ts.net" }),
  ).toBe("https://pc.tail.ts.net/api");
});

test("on the Vite dev server (5173) the API is on port 8000 of the same host", () => {
  expect(
    apiUrlFor({ protocol: "http:", hostname: "localhost", port: "5173", origin: "http://localhost:5173" }),
  ).toBe("http://localhost:8000/api");
});
