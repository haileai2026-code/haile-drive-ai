import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/classes")({
  beforeLoad: () => { throw redirect({ to: "/admin/organization" }); },
});
