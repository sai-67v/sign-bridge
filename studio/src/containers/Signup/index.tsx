import { Link, useNavigate } from "react-router-dom"
import {
  HiOutlineMail,
  HiOutlineLockClosed,
  HiClipboardCheck,
  HiOutlineCalendar,
  HiOutlineUser,
  HiOutlineGlobe,
} from "react-icons/hi"
import { useFormik } from "formik"
import { signIn, signUp, verifyEmail } from "../../services/sign"
import { addUser } from "../../services/users"
import { toTimestame } from "../../libs/date"
import { guidGenerator } from "../../libs/utils";
import { message } from "../../components/message"
import { useState } from "react"
import { isValidPassword } from "../../libs/password"
import { createFreePlan } from "../../services/plans"
import { sendNotification } from "../../libs/notify"
import { seAddNewEmailObject } from "../../libs/search"
import { isAppwriteAuthEnabled, signUp as appwriteSignUp, getAuthErrorMessage } from "../../libs/appwriteAuth"
import type { UserRole } from "../../services/roleService"

function Signup() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const formik = useFormik({
    initialValues: {
      fullname: "",
      email: "",
      password: "",
      address: "",
      photoURL: "",
      dateOfBirth: new Date().toDateString(),
      isTeacher: false,
    },
    onSubmit: async (user) => {
      const { email, password, address, dateOfBirth, fullname, photoURL, isTeacher } = user

      if (loading) return
      setLoading(true)

      const finalPhotoURL = photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(fullname || email) + '&background=random';

      if (isAppwriteAuthEnabled()) {
        try {
          if (!password || password.length < 8) {
            message.error("Password must be at least 8 characters");
            setLoading(false);
            return;
          }
          const role: UserRole = isTeacher ? 'teacher' : 'student';
          await appwriteSignUp(email, password, fullname || undefined, role);
          message.success("Account created. You're now signed in.");
          window.location.href = "/app/pad";
        } catch (err: unknown) {
          console.error("Appwrite sign up error:", err);
          message.error(getAuthErrorMessage(err));
        } finally {
          setLoading(false);
        }
        return;
      }

      const demoMode = process.env.REACT_APP_DEMO_MODE === 'true' || !process.env.REACT_APP_FIREBASE_API_KEY;
      if (demoMode) {
        const demoUser = {
          email: email,
          displayName: fullname || email.split('@')[0],
          uid: 'demo-' + Date.now(),
          photoURL: finalPhotoURL,
        };
        localStorage.setItem('demoUser', JSON.stringify(demoUser));
        message.success("Demo mode — account created.")
        setLoading(false);
        navigate("/");
        return;
      }

      if (!isValidPassword(password)) {
        message.error("Password must be 8–16 characters with uppercase, lowercase, and at least 1 digit.")
        setLoading(false)
        return
      }

      signUp(email, password)
        .then(async (userCredential) => {
          const { user } = userCredential

          const objectID = guidGenerator()
          sendNotification(`${email} just signed up.`)
          await addUser({
            uid: user.uid,
            searchID: objectID,
            fullname,
            email,
            address,
            photoURL: finalPhotoURL,
            dateOfBirth: toTimestame(dateOfBirth),
          })

          seAddNewEmailObject({
            objectID,
            uid: user.uid,
            email,
            fullname,
            photoURL: finalPhotoURL,
          })

          const res = await signIn(email, password)

          await createFreePlan()
          await verifyEmail()

          if (res) {
            navigate(`/email-verification?email=${email}`)
          }
        })
        .catch((error) => {
          console.dir(error.code)

          switch (error.code) {
            case "auth/invalid-email":
              message.error("That email address is invalid.")
              break

            case "auth/internal-error":
              message.error("An internal error occurred. Please try again.")
              break

            case "auth/email-already-in-use":
              message.error("An account with that email already exists.")
              break

            default:
              message.error("Something went wrong. Please try again.")
              break
          }
        })
        .finally(() => {
          setLoading(false)
        })
    },
  })

  return (
    <div>
      <div className="sign-container flex-col gap-8">
        <div className="sign sign-up">
          <h2 className="sign-title flex items-center gap-2">
            <HiClipboardCheck className="h-7 w-7 rounded-full p-1.5 flex-shrink-0" style={{ color: 'var(--common-primary-color)', backgroundColor: 'rgba(139,92,246,0.1)' }} aria-hidden="true" />
            <span>Sign Up</span>
          </h2>
          <p className="sign-desc">
            Create an account — it only takes a few seconds.
          </p>

          <form className="sign-form mt-6" onSubmit={formik.handleSubmit} noValidate>
            <div className="input-group">
              <label htmlFor="fullname" className="sr-only">
                Full name
              </label>
              <div className="form-control">
                <div className="form-icon">
                  <HiOutlineUser className="h-5 w-5" aria-hidden="true" />
                </div>
                <input
                  type="text"
                  name="fullname"
                  id="fullname"
                  autoComplete="name"
                  onChange={formik.handleChange}
                  value={formik.values.fullname}
                  placeholder="Full Name…"
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="signup-email" className="sr-only">
                Email address
              </label>
              <div className="form-control">
                <div className="form-icon">
                  <HiOutlineMail className="h-5 w-5" aria-hidden="true" />
                </div>
                <input
                  type="email"
                  name="email"
                  id="signup-email"
                  autoComplete="email"
                  spellCheck={false}
                  onChange={formik.handleChange}
                  value={formik.values.email}
                  placeholder="Email…"
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="signup-password" className="sr-only">
                Password
              </label>
              <div className="form-control">
                <div className="form-icon">
                  <HiOutlineLockClosed className="h-5 w-5" aria-hidden="true" />
                </div>
                <input
                  type="password"
                  name="password"
                  id="signup-password"
                  autoComplete="new-password"
                  placeholder="Password…"
                  onChange={formik.handleChange}
                  value={formik.values.password}
                />
              </div>
            </div>

            <div className="input-group inp-date">
              <label htmlFor="date" className="sr-only">
                Date of birth
              </label>
              <div className="form-control">
                <div className="form-icon">
                  <HiOutlineCalendar className="h-5 w-5" aria-hidden="true" />
                </div>
                <input
                  type="date"
                  name="date"
                  id="date"
                  autoComplete="bday"
                  placeholder="Date of Birth…"
                  onChange={(ev) => {
                    formik.setFieldValue("dateOfBirth", ev.target.value)
                  }}
                  value={formik.values.dateOfBirth}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="address" className="sr-only">
                Address
              </label>
              <div className="form-control">
                <div className="form-icon">
                  <HiOutlineGlobe className="h-5 w-5" aria-hidden="true" />
                </div>
                <input
                  type="text"
                  name="address"
                  id="address"
                  autoComplete="street-address"
                  placeholder="Address…"
                  onChange={formik.handleChange}
                  value={formik.values.address}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isTeacher"
                  checked={formik.values.isTeacher}
                  onChange={formik.handleChange}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: 'var(--common-primary-color)' }}
                />
                <span className="text-sm" style={{ color: 'var(--common-semidark-text-color)' }}>
                  I am a teacher
                </span>
              </label>
            </div>

            <div className="input-group">
              <button
                type="submit"
                className="btn btn-xl btn-block btn-primary"
                disabled={loading}
                aria-disabled={loading}
              >
                {loading ? "Creating account…" : "Sign Up"}
              </button>
            </div>

            <div className="input-group">
              <p className="text-xs" style={{ color: 'var(--common-semidark-text-color)' }}>
                <span>Already have an account? </span>
                <Link
                  to={"/signin"}
                  className="font-medium hover:underline"
                  style={{ color: 'var(--common-primary-color)' }}
                >
                  Sign In
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Signup
