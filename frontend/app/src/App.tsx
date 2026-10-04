import { Route, Routes } from "react-router";
import LoginPage from "./auth/LoginPage";
import RequireAuth from "./auth/RequireAuth";
import Layout from "./components/Layout";
import AccountDetailPage from "./features/accounts/AccountDetailPage";
import AccountsPage from "./features/accounts/AccountsPage";
import BorrowersPage from "./features/borrowers/BorrowersPage";
import LoanDetailPage from "./features/loans/LoanDetailPage";
import LoanForm from "./features/loans/LoanForm";
import LoansPage from "./features/loans/LoansPage";
import PlaceholderPage from "./pages/PlaceholderPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<PlaceholderPage title="Resumen" />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="accounts/:id" element={<AccountDetailPage />} />
        <Route path="borrowers" element={<BorrowersPage />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="loans/new" element={<LoanForm />} />
        <Route path="loans/:id" element={<LoanDetailPage />} />
        <Route path="projection" element={<PlaceholderPage title="Proyección" />} />
      </Route>
    </Routes>
  );
}
