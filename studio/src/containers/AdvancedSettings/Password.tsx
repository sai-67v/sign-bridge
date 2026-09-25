import { HiOutlineLockClosed } from "react-icons/hi"
import { useState } from "react"
import { message } from "../../components/message"
import Button from "../../components/Button"
import { account } from "../../libs/appwrite"

const MIN_LENGTH = 8

function isValidPassword(p: string) {
  return p.length >= MIN_LENGTH
}

export default function Password() {
  const [loading, setLoading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    if (!currentPassword) {
      message.error('Please enter your current password')
      return
    }
    if (!isValidPassword(newPassword)) {
      message.error(`New password must be at least ${MIN_LENGTH} characters`)
      return
    }
    if (newPassword !== confirmPassword) {
      message.error('New password and confirmation do not match')
      return
    }

    setLoading(true)
    try {
      await account.updatePassword(newPassword, currentPassword)
      message.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Failed to change password'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="shadow border border-color-base sm:rounded-md sm:overflow-hidden">
      <div className="advanced-setting-card px-0">
        <div className="px-6 space-y-3">
          <div>
            <h3 className="title">Change Password</h3>
            <p className="paragraph">
              Enter your current password and choose a new one (min. {MIN_LENGTH} characters).
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 space-y-4 mt-2">
            <div className="form-control">
              <label htmlFor="current-password">Current password</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="form-icon">
                  <HiOutlineLockClosed className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  autoComplete="current-password"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="form-control">
              <label htmlFor="new-password">New password</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="form-icon">
                  <HiOutlineLockClosed className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder={`At least ${MIN_LENGTH} characters`}
                  autoComplete="new-password"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="form-control">
              <label htmlFor="confirm-password">Confirm new password</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="form-icon">
                  <HiOutlineLockClosed className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="form-control">
              <Button submit disabled={loading}>
                {loading ? 'Updating…' : 'Update password'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
