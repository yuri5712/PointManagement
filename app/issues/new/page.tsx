import { AppHeader } from "@/components/app-header"
import { IssueCreateForm } from "@/components/issue-create-form"

export default function NewIssuePage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <IssueCreateForm />
      </main>
    </div>
  )
}
