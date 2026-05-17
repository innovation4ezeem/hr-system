import Link from 'next/link';

export default function NotFound() {
	return (
		<main className="min-h-screen grid place-items-center px-6 text-center" style={{ background: 'rgb(15 15 20)' }}>
			<div>
				<h1 className="text-4xl font-bold text-white">404</h1>
				<p className="mt-3 text-slate-300">The page you are looking for does not exist.</p>
				<Link
					href="/manager-dashboard"
					className="inline-flex mt-6 rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
				>
					Back to dashboard
				</Link>
			</div>
		</main>
	);
}
