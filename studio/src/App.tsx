import React, { useEffect } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import Layout from "./components/Layout"
import LayoutClear from "./components/Layout/LayoutClear"
import PrivateRoute from "./components/PrivateRoute"
import RoleRoute from "./components/RoleRoute"
import CommandPalletesSetting from "./containers/AdvancedSettings/CommandPalletes"
import FileManager from "./containers/AdvancedSettings/FileManager"
import Privacy from "./containers/AdvancedSettings/Privacy"
import Checking from "./containers/Checking"
import EmailVerification from "./containers/EmailVerification"
import ForgotPassword from "./containers/ForgotPassword"
import LockScreen from "./containers/LockScreen"
import Pad from "./containers/Pad"
import PadContent from "./containers/Pads/PadContent"
import PadEmpty from "./containers/Pads/PadEmpty"
import ClassroomHub from "./containers/ClassroomHub"
import StudentWorksheetAssignment from "./containers/StudentWorksheetAssignment"
import SubmissionDeepLinkRedirect from "./containers/SubmissionDeepLinkRedirect"
import TeacherDashboard from "./containers/TeacherDashboard"
import Signin from "./containers/Signin"
import Signout from "./containers/Signout"
import Signup from "./containers/Signup"
import ThemeColor from "./containers/Theme"
import ThemeCustom from "./containers/Theme/ThemeCustom"
import ThemeSetting from "./containers/Theme/ThemeSetting"
import { isDesktopApp } from "./libs/utils"
import { AuthenProvider } from "./providers/Authenticator"
import { client } from "./libs/appwrite"
import AdminClassroomRoster from "./containers/AdminClassroomRoster"
import NotificationsPanel from "./containers/NotificationsPanel"
import { OverlayHost } from "./components/OverlayHost/OverlayHost"

const lz = React.lazy

const LayoutSetting = lz(() => import("./components/Layout/LayoutSetting"))
const Profile = lz(() => import("./containers/AdvancedSettings/Profile"))
const Password = lz(() => import("./containers/AdvancedSettings/Password"))
const Plan = lz(() => import("./containers/AdvancedSettings/Plan"))
const NotFound = lz(() => import("./containers/NotFound"))

function App() {
  const isWebversion = !isDesktopApp()

  useEffect(() => {
    client.ping()
      .then(() => {
        console.log("✅ Appwrite connection verified");
      })
      .catch((error) => {
        console.error("❌ Appwrite connection failed:", error);
      });
  }, []);

  return (
    <div className={`app-container ${isWebversion ? "is-web-app" : ""}`}>
      <AuthenProvider>
        <LockScreen />
        <ThemeSetting>
          <div className="app-main-layout">
            <Routes>
            <Route path="/" element={<LayoutClear />}>
              <Route index element={<Checking />} />
              <Route path="signin" element={<Signin />} />
              <Route path="signout" element={<Signout />} />
              <Route path="signup" element={<Signup />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route
                path="email-verification"
                element={<EmailVerification />}
              />
            </Route>
            <Route path="/app" element={<Layout />}>
              <Route
                path="pad"
                element={
                  <PrivateRoute>
                    <Pad />
                  </PrivateRoute>
                }
              >
                <Route index element={<PadEmpty />} />
                <Route path="classroom/:classroomId" element={<ClassroomHub />} />
                <Route path="assignment/:submissionId" element={<StudentWorksheetAssignment />} />
                <Route path=":id" element={<PadContent />} />
              </Route>
              <Route
                path="teacher"
                element={
                  <RoleRoute allowedRoles={['teacher', 'admin']}>
                    <TeacherDashboard />
                  </RoleRoute>
                }
              />
              <Route
                path="classrooms"
                element={
                  <PrivateRoute>
                    <Navigate to="/app/pad#pad-home-classes" replace />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/classrooms"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminClassroomRoster />
                  </RoleRoute>
                }
              />
              <Route
                path="notifications"
                element={
                  <PrivateRoute>
                    <NotificationsPanel />
                  </PrivateRoute>
                }
              />
              <Route
                path="submissions"
                element={
                  <RoleRoute allowedRoles={['teacher', 'admin']}>
                    <Navigate to="/app/pad#pad-home-classes" replace />
                  </RoleRoute>
                }
              />
              <Route
                path="submissions/:distributionId"
                element={
                  <RoleRoute allowedRoles={['teacher', 'admin']}>
                    <SubmissionDeepLinkRedirect />
                  </RoleRoute>
                }
              />
            </Route>
            <Route
              path="/theme-customization"
              element={<ThemeCustom />}
            ></Route>
            <Route
              path="setting"
              element={
                <PrivateRoute>
                  <React.Suspense fallback={<>...</>}>
                    <LayoutSetting />
                  </React.Suspense>
                </PrivateRoute>
              }
            >
              {/* <Route index element={<PadEmpty />}></Route> */}
              <Route path="profile" element={<Profile />}></Route>
              <Route path="password" element={<Password />}></Route>
              <Route path="plan" element={<Plan />}></Route>
              <Route path="theme" element={<ThemeColor />}></Route>
              <Route path="file-manager" element={<FileManager />}></Route>
              <Route path="privacy" element={<Privacy />}></Route>
              <Route
                path="command-palletes"
                element={<CommandPalletesSetting />}
              ></Route>
              <Route path="*" element={<NotFound />}></Route>
            </Route>
            <Route path="*" element={<NotFound />}></Route>
          </Routes>
          </div>
          <OverlayHost />
        </ThemeSetting>
      </AuthenProvider>
    </div>
  )
}

export default App
