import { Link, useNavigate } from "react-router-dom"
import { HiOutlineKey } from "react-icons/hi"
import { useFormik } from "formik"
import { signIn } from "../services/sign"
import { message } from "../components/message"
import { sendNotification } from "../libs/notify"
import { isAppwriteAuthEnabled, login, getAuthErrorMessage } from "../libs/appwriteAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

function Signin() {
  const navigate = useNavigate()
  const useAppwrite = isAppwriteAuthEnabled()

  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ email, password }, { setSubmitting }) => {
      setSubmitting(true)
      try {
        if (useAppwrite) {
          try {
            await login(email, password)
            message.success("Signed in successfully")
            window.location.href = "/app/pad"
          } catch (err: unknown) {
            console.error("Appwrite sign in error:", err)
            message.error(getAuthErrorMessage(err))
          }
          return
        }

        const demoMode = process.env.REACT_APP_DEMO_MODE === "true" || !process.env.REACT_APP_FIREBASE_API_KEY
        if (demoMode) {
          const demoUser = {
            email,
            displayName: email.split("@")[0],
            uid: "demo-" + Date.now(),
            photoURL: "https://ui-avatars.com/api/?name=" + encodeURIComponent(email),
          }
          localStorage.setItem("demoUser", JSON.stringify(demoUser))
          message.success("Demo mode — logged in.")
          window.location.href = "/app/pad"
          return
        }

        const user = await signIn(email, password)
        if (user) {
          message.success("Signed in successfully.")
          sendNotification(`${email} just signed in.`)
          navigate("/")
        } else {
          message.error("Invalid username or password.")
        }
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code
        let mess = "Something went wrong. Please try again."
        switch (code) {
          case "auth/wrong-password":
            mess = "Wrong password. Please try again."
            break
          case "auth/user-not-found":
            mess = "No account found with that email."
            break
          case "auth/internal-error":
            mess = "An internal error occurred. Please try again."
            break
          case "auth/invalid-email":
            mess = "That email address is invalid."
            break
          default:
            break
        }
        message.error(mess)
        console.dir(err)
      } finally {
        setSubmitting(false)
      }
    },
  })

  return (
    <div className="sign-container">
      <section
        aria-labelledby="signin-heading"
        className={cn(
          "relative z-10 w-full max-w-[26rem] rounded-2xl border border-border bg-card p-8 text-card-foreground shadow-paper",
          "animate-fade-in-up"
        )}
      >
        <header className="flex flex-col items-center gap-3 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted/60 text-foreground shadow-sm"
            aria-hidden
          >
            <HiOutlineKey className="h-6 w-6" />
          </span>
          <div className="space-y-1.5">
            <h1 id="signin-heading" className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome to canis.studio
            </h1>
            <p className="text-sm text-muted-foreground">Enter your credentials to continue</p>
          </div>
        </header>

        <form className="mt-8 space-y-5" onSubmit={formik.handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              spellCheck={false}
              placeholder="you@school.edu"
              onChange={formik.handleChange}
              value={formik.values.email}
              disabled={formik.isSubmitting}
              className="h-11 bg-background"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">Password</Label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              onChange={formik.handleChange}
              value={formik.values.password}
              disabled={formik.isSubmitting}
              className="h-11 bg-background"
            />
          </div>

          <Button type="submit" className="h-11 w-full font-semibold shadow-sm" disabled={formik.isSubmitting}>
            {formik.isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </section>

      <p className="relative z-10 mt-8 text-center text-sm text-muted-foreground">
        Don&apos;t have an account yet?{" "}
        <Link
          to="/signup"
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
        >
          Register
        </Link>
      </p>
    </div>
  )
}

export default Signin
