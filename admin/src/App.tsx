import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import BuyerList from './pages/BuyerList';
import BuyerProfile from './pages/BuyerProfile';
import Payments from './pages/Payments';
import AdditionalFees from './pages/AdditionalFees';
import PopQueue from './pages/PopQueue';
import StandManagement from './pages/StandManagement';
import Login from './pages/Login';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';
import HomeRoute from './components/HomeRoute';

import ProjectManagement from './pages/ProjectManagement';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import MigrationImports from './pages/MigrationImports';
import BuyerAccounts from './pages/BuyerAccounts';
import PurchaserPayments from './pages/PurchaserPayments';
import PurchaserPaymentPlan from './pages/PurchaserPaymentPlan';
import PurchaserFees from './pages/PurchaserFees';
import PurchaserDocuments from './pages/PurchaserDocuments';
import PurchaserAnnouncements from './pages/PurchaserAnnouncements';
import PurchaserPopUpload from './pages/PurchaserPopUpload';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import SetPassword from './pages/SetPassword';
import ManageAnnouncements from './pages/ManageAnnouncements';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomeRoute />} />

            <Route element={<RoleRoute allowedRoles={['SYSTEM_ADMIN', 'PROJECT_ADMIN']} />}>
              <Route path="/buyers" element={<BuyerList />} />
              <Route path="/buyers/:id" element={<BuyerProfile />} />
              <Route path="/buyer-accounts" element={<BuyerAccounts />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/additional-fees" element={<AdditionalFees />} />
              <Route path="/pop-queue" element={<PopQueue />} />
              <Route path="/stands" element={<StandManagement />} />
              <Route path="/projects" element={<ProjectManagement />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/migration" element={<MigrationImports />} />
              <Route path="/announcements" element={<ManageAnnouncements />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            <Route element={<RoleRoute allowedRoles={['BUYER']} />}>
              <Route path="/account/payments" element={<PurchaserPayments />} />
              <Route path="/account/payment-plan" element={<PurchaserPaymentPlan />} />
              <Route path="/account/fees" element={<PurchaserFees />} />
              <Route path="/account/documents" element={<PurchaserDocuments />} />
              <Route path="/account/updates" element={<PurchaserAnnouncements />} />
              <Route path="/account/proof-of-payment" element={<PurchaserPopUpload />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
