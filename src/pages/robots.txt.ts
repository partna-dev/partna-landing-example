import type { APIRoute } from "astro";

export const GET: APIRoute = () => {
  const robots = import.meta.env.PUBLIC_ROBOTS || "index";
  const body =
    robots === "noindex"
      ? "User-agent: *\nDisallow: /\n"
      : "User-agent: *\nAllow: /\n";
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
