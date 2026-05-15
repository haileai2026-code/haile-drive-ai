import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/exams")({
  head: () => ({ meta: [{ title: "מבחנים — Haile Drive AI" }] }),
  beforeLoad: ({ location }) => {
    if (location.pathname === "/admin/exams" || location.pathname === "/admin/exams/") {
      throw redirect({ to: "/admin/content" });
    }
  },
  component: () => <Outlet />,
});
