import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AppProvider } from '@/context/AppContext';
import '../styles/tailwind.css';

export const metadata: Metadata = {
	title: 'HR Operations',
	description: 'HR operations and performance management portal',
};

import { Toaster } from 'sonner';

import ProgressBar from '@/components/ui/ProgressBar';
import { Suspense } from 'react';

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const cookieStore = await cookies();
	const decodeCookieValue = (value: string | undefined) => {
		if (!value) return undefined;
		try {
			return decodeURIComponent(value);
		} catch {
			return value;
		}
	};

	const selectedYearCookie = cookieStore.get('ezeem_selected_year')?.value;
	const parsedYear = selectedYearCookie ? Number(selectedYearCookie) : undefined;
	const bootstrap = {
		userRole: (cookieStore.get('ezeem_role')?.value as 'admin' | 'hod' | 'employee' | undefined) ?? undefined,
		userId: cookieStore.get('ezeem_user_id')?.value ?? undefined,
		userName: decodeCookieValue(cookieStore.get('ezeem_user_name')?.value),
		userDepartment: cookieStore.get('ezeem_department')?.value ?? undefined,
		selectedYear: Number.isInteger(parsedYear) ? parsedYear : undefined,
		themeMode: (cookieStore.get('ezeem_theme')?.value as 'light' | 'dark' | undefined) ?? undefined,
	};

	return (
		<html lang="en" suppressHydrationWarning>
			<body className="antialiased" suppressHydrationWarning>
				<AppProvider bootstrap={bootstrap}>
					<Suspense fallback={null}>
						<ProgressBar />
					</Suspense>
					{children}
					<Toaster richColors position="top-right" closeButton />
				</AppProvider>
			</body>
		</html>
	);
}
