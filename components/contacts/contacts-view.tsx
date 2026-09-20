"use client"

import { useState } from "react"
import { colors } from "@/lib/theme"
import { useContacts } from "@/lib/hooks/use-contacts"
import ContactModal from "@/components/contacts/contact-modal"
import type { ApplicationWithJob, Contact } from "@/lib/types"

// applications is passed down from the dashboard's already-live
// useApplications() subscription rather than re-queried here, just to
// resolve each contact's linked companies for display.
export default function ContactsView({ applications }: { applications: ApplicationWithJob[] }) {
  const { contacts, loading } = useContacts()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  const companiesFor = (contact: Contact) =>
    contact.applicationIds
      .map((id) => applications.find((a) => a.id === id)?.job?.company)
      .filter((c): c is string => Boolean(c))

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: colors.text, fontFamily: "var(--font-space-grotesk)" }}>
            Contacts
          </h2>
          <p className="mt-1 text-sm" style={{ color: colors.muted }}>
            Everyone you&apos;ve been in touch with, across applications.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90"
          style={{ borderColor: colors.border, color: colors.text }}
        >
          + Add contact
        </button>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: colors.muted }}>
          Loading…
        </p>
      ) : contacts.length === 0 ? (
        <div
          className="rounded-lg border border-dashed p-8 text-center text-sm"
          style={{ borderColor: colors.border, color: colors.muted }}
        >
          No contacts yet — add one, or link one from an application&apos;s detail view.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {contacts.map((contact) => {
            const companies = companiesFor(contact)
            return (
              <button
                key={contact.id}
                type="button"
                onClick={() => setEditingContact(contact)}
                className="w-full rounded-lg border p-3.5 text-left transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.card, borderColor: colors.border }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: colors.text }}>
                      {contact.name}
                    </h3>
                    {contact.role && (
                      <p className="mt-0.5 text-sm" style={{ color: colors.muted }}>
                        {contact.role}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-sm" style={{ color: colors.muted }}>
                    {contact.email && <div>{contact.email}</div>}
                    {contact.phone && <div>{contact.phone}</div>}
                  </div>
                </div>
                {companies.length > 0 && (
                  <p className="mt-2 text-xs" style={{ color: colors.teal }}>
                    Linked to {companies.join(", ")}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}

      {showAddModal && <ContactModal onClose={() => setShowAddModal(false)} />}
      {editingContact && <ContactModal contact={editingContact} onClose={() => setEditingContact(null)} />}
    </div>
  )
}
