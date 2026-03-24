import { Link } from "wouter"

export function NotFound() {
	return (
		<div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
			<h1 className="text-4xl font-bold text-muted">404</h1>
			<p className="text-lg text-fg">Page not found</p>
			<p className="text-sm text-muted">The page you're looking for doesn't exist.</p>
			<Link href="/" className="text-sm text-accent hover:underline">
				← Back to Dashboard
			</Link>
		</div>
	)
}
