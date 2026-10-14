"""Spring-driven animation values for the Python renderer.

Provides a closed-form evaluator for (under)critically-damped springs so that
per-word/per-character entrance animations in the final render match the web
preview's spring-driven motion (pop-scale, drop-in, blur-in, etc.).

The web dashboard drives these animations via CSS animation-delay + keyframes
that approximate spring motion.  Here we evaluate the same spring at a given
elapsed time so the Python render produces matching per-word transforms.
"""

from __future__ import annotations

import math
from typing import NamedTuple


class SpringParams(NamedTuple):
    """Parameters for a damped harmonic oscillator.

    These map directly to the Theme fields spring_damping, spring_stiffness,
    spring_mass (see src/core/theme_loader.py DEFAULTS).
    """

    damping: float = 18.0   # c — damping coefficient
    stiffness: float = 120.0  # k — spring stiffness
    mass: float = 1.0         # m — effective mass


def spring_value(t: float, params: SpringParams = SpringParams()) -> float:
    """Evaluate a unit-step spring response at elapsed time *t*.

    The spring starts at rest at x=0 and is driven toward target x=1.
    Returns the normalized position in [0, 1] (with overshoot >1 for
    underdamped springs).

    Args:
        t: Elapsed time in seconds since the step began (t >= 0).
        params: Spring parameters (damping, stiffness, mass).

    Returns:
        Normalized spring position.  0 at t=0, approaching 1 as t -> inf.
        Underdamped springs overshoot above 1 before settling.
    """
    if t <= 0.0:
        return 0.0

    c = float(params.damping)
    k = float(params.stiffness)
    m = float(params.mass)

    # Natural frequency and damping ratio.
    omega_n = math.sqrt(k / m) if m > 0 else 0.0
    zeta = c / (2.0 * math.sqrt(k * m)) if (k > 0 and m > 0) else 1.0

    if zeta >= 1.0:
        # Critically damped or overdamped — no overshoot.
        if zeta == 1.0:
            # Critically damped closed form: x = 1 - (1 + ω·t)·e^(-ω·t)
            return 1.0 - (1.0 + omega_n * t) * math.exp(-omega_n * t)
        # Overdamped: slower, no overshoot.  Use the critically-damped form
        # with an effective (larger) damping for stability.
        eff_zeta = min(zeta, 5.0)
        # For overdamped, use two real poles.  s1, s2 = -ω·ζ ± ω·sqrt(ζ²-1)
        sqrt_term = math.sqrt(max(0.0, zeta * zeta - 1.0))
        s1 = -omega_n * (zeta - sqrt_term)
        s2 = -omega_n * (zeta + sqrt_term)
        if abs(s1 - s2) < 1e-9:
            return 1.0 - (1.0 + omega_n * t) * math.exp(-omega_n * t)
        # x(t) = 1 - (s2·e^(s1·t) - s1·e^(s2·t)) / (s2 - s1)
        return 1.0 - (s2 * math.exp(s1 * t) - s1 * math.exp(s2 * t)) / (s2 - s1)

    # Underdamped: oscillatory with exponential decay (overshoot).
    # ω_d = ω_n · sqrt(1 - ζ²)
    omega_d = omega_n * math.sqrt(max(0.0, 1.0 - zeta * zeta))
    exp_term = math.exp(-zeta * omega_n * t)
    cos_term = math.cos(omega_d * t)
    sin_term = math.sin(omega_d * t)
    # x(t) = 1 - e^(-ζ·ω·t) · (cos(ω_d·t) + (ζ·ω_n/ω_d)·sin(ω_d·t))
    coeff = (zeta * omega_n / omega_d) if omega_d > 1e-9 else 0.0
    return 1.0 - exp_term * (cos_term + coeff * sin_term)


def spring_value_clamped(t: float, params: SpringParams = SpringParams()) -> float:
    """Evaluate *spring_value* and clamp to [0, 1] (no overshoot visible).

    Use this for entrance animations where overshoot would look odd (e.g. blur-in).
    """
    v = spring_value(t, params)
    if v < 0.0:
        return 0.0
    if v > 1.0:
        return 1.0
    return v


def pop_scale_value(t: float, params: SpringParams = SpringParams()) -> float:
    """Spring value for pop-scale entrance: overshoots above 1 then settles.

    Maps the spring's 0→1 response to a scale that goes 0.7 → ~1.1 → 1.0.
    """
    s = spring_value(t, params)
    # scale = 0.7 + 0.4·s  → at s=0: 0.7; at s=1: 1.1; settles at 1.1 (then we clamp to 1.0 externally)
    raw = 0.7 + 0.4 * s
    if raw > 1.05:
        # After the overshoot peak, settle back toward 1.0.
        # Once s passes ~0.95, start returning toward 1.0.
        return 1.0 + (raw - 1.0) * 0.3
    return raw


def blur_value(t: float, params: SpringParams = SpringParams()) -> float:
    """Blur radius for blur-in entrance: 12px → 0 as the spring rises.

    Returns the blur radius in pixels.  12 at t=0, approaching 0.
    """
    s = spring_value_clamped(t, params)
    return 12.0 * (1.0 - s)


def translate_value(t: float, params: SpringParams = SpringParams(), peak: float = 60.0) -> float:
    """Vertical translate for drop-in entrance: -peak → 0 with spring overshoot.

    Returns the y-offset in pixels.  -peak at t=0, approaching 0.
    """
    s = spring_value(t, params)
    raw = -peak * (1.0 - s)
    if raw > 0:
        # Overshoot past 0 (bounce up slightly), then settle.
        return raw * 0.4
    return raw


def stagger_delay(word_index: int, char_stagger_ms: int, order: str = "sequential") -> float:
    """Return the entrance delay in seconds for the *word_index*-th token.

    Args:
        word_index: Zero-based index of the token within the line.
        char_stagger_ms: Milliseconds between each token's entrance (0 = no stagger).
        order: 'sequential' (wave: left-to-right) or 'random' (raindrop).

    Returns:
        Delay in seconds before this token's entrance begins.
    """
    if char_stagger_ms <= 0:
        return 0.0
    if order == "random":
        import random
        return (hash((word_index, 9999)) % char_stagger_ms) / 1000.0
    return (word_index * char_stagger_ms) / 1000.0
