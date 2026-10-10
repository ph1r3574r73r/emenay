# Absolute paths so recipes work even when rustup isn't on PATH (common with BSD make / GUI terminals)
CARGO := $(HOME)/.cargo/bin/cargo
CARGO_TAURI := $(HOME)/.cargo/bin/cargo-tauri
# Child tools (cargo-tauri -> cargo) also need this
export PATH := $(HOME)/.cargo/bin:$(PATH)

.PHONY: test spice check ui-build desktop-dev desktop-check

test:
	$(CARGO) test -p emenay-circuit -p emenay-engine -p emenay-modules -p emenay-spice

spice:
	$(CARGO) run -p emenay-spice --bin emenay-spice-check

check: test spice
	$(CARGO) check -p emenay-desktop

ui-build:
	cd apps/web-ui && npm run build

desktop-dev:
	cd apps/desktop/src-tauri && PATH="$(HOME)/.cargo/bin:$$PATH" $(CARGO_TAURI) dev

desktop-check:
	$(CARGO) check -p emenay-desktop
