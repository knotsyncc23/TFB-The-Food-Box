import { Link } from "react-router-dom"
import { useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

const KEY_EMAIL = "user_settings_email_notifications"
const KEY_PUSH = "user_settings_push_notifications"

function readBool(key, defaultValue = true) {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return defaultValue
    return v === "true"
  } catch {
    return defaultValue
  }
}

export default function Settings() {
  const [emailOn, setEmailOn] = useState(true)
  const [pushOn, setPushOn] = useState(true)

  useEffect(() => {
    setEmailOn(readBool(KEY_EMAIL, true))
    setPushOn(readBool(KEY_PUSH, true))
  }, [])

  const persist = (key, value) => {
    try {
      localStorage.setItem(key, value ? "true" : "false")
    } catch {
      /* ignore */
    }
  }

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a] p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/user/profile">
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
              <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
            </Button>
          </Link>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-black dark:text-white">
            Notification Setting
          </h1>
        </div>
        <Card className="bg-white dark:bg-[#1a1a1a] border-0 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">
              Notifications & Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive updates about your orders via email
                </p>
              </div>
              <Switch
                checked={emailOn}
                onCheckedChange={(v) => {
                  setEmailOn(v)
                  persist(KEY_EMAIL, v)
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive push notifications on your device
                </p>
              </div>
              <Switch
                checked={pushOn}
                onCheckedChange={(v) => {
                  setPushOn(v)
                  persist(KEY_PUSH, v)
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  )
}
