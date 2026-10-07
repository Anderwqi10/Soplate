import { Route, Routes } from "react-router";
import LoginPage from "./auth/LoginPage";
import RequireAuth from "./auth/RequireAuth";
import Layout from "./components/Layout";
import AccountDetailPage from "./features/accounts/AccountDetailPage";
import AccountsPage from "./features/accounts/AccountsPage";
import BorrowerProfilePage from "./features/borrowers/BorrowerProfilePage";
import BorrowersPage from "./features/borrowers/BorrowersPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import LoanDetailPage from "./features/loans/LoanDetailPage";
import LoanForm from "./features/loans/LoanForm";
import LoansPage from "./features/loans/LoansPage";
import ProjectionPage from "./features/projection/ProjectionPage";

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
        <Route index element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="accounts/:id" element={<AccountDetailPage />} />
        <Route path="borrowers" element={<BorrowersPage />} />
        <Route path="borrowers/:id" element={<BorrowerProfilePage />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="loans/new" element={<LoanForm />} />
        <Route path="loans/:id" element={<LoanDetailPage />} />
        <Route path="projection" element={<ProjectionPage />} />
      </Route>
    </Routes>
  );
}
