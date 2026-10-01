"""
Centered scalar TOT dynamics, in the paper's intended sign convention.

    xdot = alpha * x * |x|^(delta-1)   -   kappa * x
           outward pole attraction          inward restoration

This replaces an earlier script of mine that used inward attraction and
therefore identified alpha+kappa. The intended model identifies alpha-kappa,
and the qualitative behaviour is different in a way that matters.
"""
import numpy as np

def f(x, a, k, d):
    return a * np.sign(x) * abs(x)**d - k * x     # x*|x|^(d-1) == sign(x)*|x|^d

def integrate(x0, a, k, d, dt=2e-5, tmax=30.0, blow=1e6):
    x, t, traj = x0, 0.0, []
    n = int(tmax/dt)
    for i in range(n):
        x += f(x, a, k, d) * dt
        t += dt
        if i % 500 == 0: traj.append((t, x))
        if abs(x) > blow or not np.isfinite(x): return 'diverged', x, traj
        if abs(x) < 1e-12: return 'center', x, traj
    return 'settled', x, traj

print("1. INTERIOR EQUILIBRIUM  x* = (alpha/kappa)^(1/(1-delta))")
print(f"{'delta':>6} {'alpha':>6} {'kappa':>6} {'x* predicted':>14} {'x* observed':>13}  {'origin is':>10}")
for d, a, k in [(0.5,1.0,2.0), (0.5,1.0,1.0), (0.75,1.0,2.0),
                (1.5,1.0,2.0), (2.0,1.0,2.0)]:
    pred = (a/k)**(1.0/(1.0-d)) if d != 1 else float('nan')
    # start just off centre and just inside/outside the predicted shell
    _, x_in,  _ = integrate(1e-3, a, k, d)
    origin = "repelling" if abs(x_in) > 1e-6 else "attracting"
    obs = abs(x_in)
    print(f"{d:>6} {a:>6} {k:>6} {pred:>14.4f} {obs:>13.4f}  {origin:>10}")

print()
print("2. STABILITY OF THE CENTRE, by delta (alpha=1, kappa=2, x0=1e-3)")
for d in [0.5, 0.9, 1.0, 1.1, 2.0]:
    end, xf, _ = integrate(1e-3, 1.0, 2.0, d)
    note = {"center":"collapses to centre", "diverged":"runs away",
            "settled":"settles off-centre"}[end]
    print(f"  delta={d:<4} -> {note:<22} final |x| = {abs(xf):.6f}")
print("  at delta<1 the outward term beats linear restoration near zero for ANY alpha>0,")
print("  so the centre is a repeller and the shell (alpha/kappa)^(1/(1-delta)) is the attractor.")
print("  at delta>1 the centre is locally stable and the shell is the escape threshold.")
print("  delta=1 has no interior equilibrium at all: it is the knife edge.")

print()
print("3. IDENTIFIABILITY AT delta=1  (xdot = (alpha-kappa) x)")
t = np.linspace(0, 4, 400)
ref = 0.1*np.exp((1.5-2.0)*t)
for a, k in [(1.5,2.0), (0.5,1.0), (3.0,3.5), (0.0,0.5)]:
    err = np.abs(0.1*np.exp((a-k)*t) - ref).max()
    print(f"  alpha={a:<4} kappa={k:<4} (alpha-kappa={a-k:>5.1f})  max error vs reference: {err:.2e}")
print("  -> only alpha-kappa is identifiable; the split is free.")

print()
print("4. IDENTIFIABILITY AWAY FROM delta=1 (delta=0.5, same alpha-kappa)")
ref_end = None
for a, k in [(1.0,2.0), (2.0,3.0), (3.0,4.0)]:
    _, xf, _ = integrate(1e-3, a, k, 0.5)
    shell = (a/k)**(1/(1-0.5))
    print(f"  alpha={a:<4} kappa={k:<4} (alpha-kappa=-1.0)  settles at |x|={abs(xf):.4f}  shell={shell:.4f}")
print("  -> different splits give different equilibria. delta != 1 restores identifiability,")
print("     and the equilibrium radius identifies the RATIO alpha/kappa directly.")
