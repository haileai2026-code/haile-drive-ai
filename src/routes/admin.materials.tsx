import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/materials")({
  beforeLoad: () => { throw redirect({ to: "/admin/content" }); },
});
