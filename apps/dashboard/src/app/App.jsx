import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SignIn } from "../core/auth/SignIn.jsx";
import { session } from "../services/api.js";
import { AppShell } from "../layouts/AppShell.jsx";
import { PluginHost } from "../plugins/plugin-host/PluginHost.jsx";
import { useNavigation } from "../hooks/useNavigation.js";
import { HomePage } from "../core/home/HomePage.jsx";
import { CompanyBrainPage } from "../core/company-brain/CompanyBrainPage.jsx";
import { NeedsYouPage } from "../core/needs-you/NeedsYouPage.jsx";
import { AskPage } from "../core/ask/AskPage.jsx";
import { BusinessProfilePage } from "../core/business-profile/BusinessProfilePage.jsx";
import { TasksPage } from "../core/tasks/TasksPage.jsx";
import { AppsPage } from "../core/apps/AppsPage.jsx";
import { MarketplacePage } from "../core/marketplace/MarketplacePage.jsx";
import { ConnectionsPage } from "../core/connections/ConnectionsPage.jsx";
import { TestLabPage } from "../core/test-lab/TestLabPage.jsx";
import { ActivityPage } from "../core/activity/ActivityPage.jsx";
import { SettingsPage } from "../core/settings/SettingsPage.jsx";

export function App() {
  const [signedIn, setSignedIn] = useState(() => Boolean(session.get()));
  const navigation = useNavigation(signedIn);

  // The server gates every /api/ route behind sign-in, so an expired or missing token
  // means show sign-in rather than an empty shell (plan section 89).
  const rejected = navigation.error?.status === 401;
  if (!signedIn || rejected) {
    return <SignIn onSignedIn={() => { setSignedIn(true); navigation.reload(); }} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell navigation={navigation} badges={{}} company="ABizCreator" />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/company-brain" element={<CompanyBrainPage />} />
          <Route path="/needs-you" element={<NeedsYouPage />} />
          <Route path="/ask" element={<AskPage />} />
          <Route path="/business-profile" element={<BusinessProfilePage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/apps" element={<AppsPage navigation={navigation} />} />
          <Route path="/marketplace" element={<MarketplacePage navigation={navigation} />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/test-lab" element={<TestLabPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/apps/:pluginId/*" element={<PluginHost navigation={navigation} />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
