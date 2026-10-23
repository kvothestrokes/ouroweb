const KEY = 'ouroboros:tema';

export type Theme = 'dia' | 'noche';

/** Day (default) or night; the choice is kept in this browser (see src/app.html). */
class ThemeStore {
	current = $state<Theme>('dia');

	/** Reads what the inline script in app.html already applied. */
	sync() {
		this.current = document.documentElement.classList.contains('dark') ? 'noche' : 'dia';
	}

	toggle() {
		this.set(this.current === 'dia' ? 'noche' : 'dia');
	}

	set(theme: Theme) {
		this.current = theme;
		const night = theme === 'noche';
		document.documentElement.classList.toggle('dark', night);
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', night ? '#0b0a0d' : '#faf7f2');
		try {
			localStorage.setItem(KEY, theme);
		} catch {
			// Storage blocked: the theme lasts for this visit.
		}
	}
}

export const theme = new ThemeStore();
