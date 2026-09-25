import { HiOutlineMail, HiOutlineUser } from "react-icons/hi"
import { useEffect, useState } from "react"
import { message } from "../../components/message"
import Button from "../../components/Button"
import { account } from "../../libs/appwrite"
import { useAuth } from "../../hooks/useAuth"
import { getProfileEmoji, updateProfileEmoji, ROLE_DEFAULT_EMOJI, isProfileEmojiAttributeMissingError } from "../../services/roleService"
import { PROFILE_EMOJI_OPTIONS } from "../../constants/profileEmojis"
import { isAppwriteAuthEnabled } from "../../libs/appwriteAuth"
import { useProfileEmojiStore } from "../../store/profileEmojiStore"

export default function Profile() {
  const { user } = useAuth()
  const setStoreEmoji = useProfileEmojiStore((s) => s.setProfileEmoji)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [profileEmoji, setProfileEmoji] = useState<string | null>(null)
  const [emojiSaving, setEmojiSaving] = useState(false)
  const role = user?.role ?? 'student'
  const displayEmoji = profileEmoji ?? ROLE_DEFAULT_EMOJI[role]

  useEffect(() => {
    account.get().then(acc => {
      setName(acc.name || '')
      setEmail(acc.email || '')
    }).catch(() => {
      // Not logged in or session expired — fields stay empty
    })
  }, [])

  useEffect(() => {
    if (!user?.uid) return
    const apply = (emoji: string | null) => {
      setProfileEmoji(emoji)
      setStoreEmoji(emoji)
    }
    if (isAppwriteAuthEnabled()) {
      getProfileEmoji(user.uid).then((emoji) => {
        if (emoji) apply(emoji)
        else {
          try {
            const stored = localStorage.getItem('canis_profile_emoji')
            if (stored) apply(stored)
            else apply(null)
          } catch {
            apply(null)
          }
        }
      })
    } else {
      try {
        const stored = localStorage.getItem('canis_profile_emoji')
        apply(stored || null)
      } catch {}
    }
  }, [user?.uid, setStoreEmoji])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    const trimmed = name.trim()
    if (!trimmed) {
      message.error('Display name cannot be empty')
      return
    }
    setLoading(true)
    try {
      await account.updateName(trimmed)
      message.success('Profile updated successfully')
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Failed to update profile'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectEmoji = async (emoji: string) => {
    if (!user?.uid || emojiSaving) return
    setEmojiSaving(true)
    try {
      if (isAppwriteAuthEnabled()) {
        try {
          await updateProfileEmoji(user.uid, emoji)
        } catch (e) {
          if (isProfileEmojiAttributeMissingError(e)) {
            localStorage.setItem('canis_profile_emoji', emoji)
            setProfileEmoji(emoji)
            setStoreEmoji(emoji)
            message.warning(
              'Profile picture saved locally. Add a "profileEmoji" string attribute to the user_profiles collection in Appwrite Console to persist it.'
            )
            return
          }
          throw e
        }
      } else {
        localStorage.setItem('canis_profile_emoji', emoji)
      }
      setProfileEmoji(emoji)
      setStoreEmoji(emoji)
      message.success('Profile picture updated')
    } catch (e) {
      console.error('Failed to set profile emoji:', e)
      message.error('Failed to update profile picture')
    } finally {
      setEmojiSaving(false)
    }
  }

  return (
    <div className="shadow border border-color-base sm:rounded-md sm:overflow-hidden">
      <div className="advanced-setting-card px-0">
        <div className="px-6 space-y-3">
          <div>
            <h3 className="title">Profile</h3>
            <p className="paragraph">Update your display name and profile picture shown across the app.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 space-y-4 mt-2">
            {/* Profile picture (emoji) */}
            <div className="form-control">
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--common-semidark-text-color)' }}>Profile picture</label>
              <p className="text-sm mb-3" style={{ color: 'var(--common-dark-text-color)' }}>Choose an emoji as your profile picture.</p>
              <div className="flex items-center gap-4 mb-3">
                <div
                  className="profile-page-emoji-preview"
                  style={{ backgroundColor: 'var(--common-btn-bg-color)', border: '1px solid var(--common-border-light-color)' }}
                  title="Current profile picture"
                >
                  {displayEmoji}
                </div>
                <span className="text-sm" style={{ color: 'var(--common-semidark-text-color)' }}>Current</span>
              </div>
              <div className="profile-page-emoji-grid">
                {PROFILE_EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="profile-page-emoji-option"
                    onClick={() => handleSelectEmoji(emoji)}
                    disabled={emojiSaving}
                    title="Select as profile picture"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Display name */}
            <div className="form-control">
              <label htmlFor="profile-name">Display name</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="form-icon">
                  <HiOutlineUser className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className="pl-10"
                />
              </div>
            </div>

            {/* Email — read only */}
            <div className="form-control">
              <label htmlFor="profile-email">Email address</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="form-icon">
                  <HiOutlineMail className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                  id="profile-email"
                  type="email"
                  value={email}
                  readOnly
                  placeholder="your@email.com"
                  className="pl-10 opacity-60 cursor-not-allowed"
                  title="Email cannot be changed here"
                />
              </div>
            </div>

            <div className="form-control">
              <Button submit disabled={loading}>
                {loading ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
