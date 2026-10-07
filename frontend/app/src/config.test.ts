import { apiUrlFor } from "./config";

test("the API is looked up on the same machine the app was opened from", () => {
  // Desde el celular la app se abre con la IP del computador; "localhost" sería el propio celular.
  expect(apiUrlFor({ protocol: "http:", hostname: "192.168.1.9" })).toBe("http://192.168.1.9:8000/api");
  expect(apiUrlFor({ protocol: "http:", hostname: "localhost" })).toBe("http://localhost:8000/api");
});
