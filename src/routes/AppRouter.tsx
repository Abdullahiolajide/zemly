import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import posthog from 'posthog-js';
import LandingPage from '../pages/LandingPage';
import AuthPage from '../pages/AuthPage';
import DashboardPage from '../pages/DashboardPage';
import NotePage from '../pages/NotePage';
import TermsPage from '../pages/TermsPage';
import PrivacyPage from '../pages/PrivacyPage';
import AboutPage from '../pages/AboutPage';
import ContactPage from '../pages/ContactPage';
import ProtectedRoute from './ProtectedRoute';

function PostHogPageView() {
    const location = useLocation();
    useEffect(() => {
        posthog.capture('$pageview', { $current_url: window.location.href });
    }, [location]);
    return null;
}

const AppRouter: React.FC = () => {
    return (
        <BrowserRouter>
            <PostHogPageView />
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <DashboardPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/notes/:noteKey/*"
                    element={
                        <ProtectedRoute>
                            <NotePage />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </BrowserRouter>
    );
};

export default AppRouter;
