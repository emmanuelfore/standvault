import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import PaymentHistory from './pages/PaymentHistory';
import PaymentSchedule from './pages/PaymentSchedule';
import Documents from './pages/Documents';
import AdditionalCharges from './pages/AdditionalCharges';
import Announcements from './pages/Announcements';
import PopUpload from './pages/PopUpload';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import SetPassword from './pages/SetPassword';
import { ProtectedRoute } from './components/ProtectedRoute';

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
            <Route path="/" element={<Dashboard />} />
            <Route path="/payments" element={<PaymentHistory />} />
            <Route path="/schedule" element={<PaymentSchedule />} />
            <Route path="/charges" element={<AdditionalCharges />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/pop-upload" element={<PopUpload />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
