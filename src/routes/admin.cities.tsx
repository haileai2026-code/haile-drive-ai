import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/cities")({
  beforeLoad: () => { throw redirect({ to: "/admin/organization" }); },
});
