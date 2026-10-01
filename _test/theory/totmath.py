import numpy as np
rng = np.random.default_rng(7)

print("A. BUDGET vs VERTEX PROXIMITY on the Lp unit sphere (3 axes)")
print(f"{'p':>5} {'budget sum|x| (min..max)':>28} {'corr(budget, max|x|)':>22}")
for p in [1.0, 1.3, 2.0, 3.0]:
    X = rng.normal(size=(20000,3))
    X /= (np.abs(X)**p).sum(1, keepdims=True)**(1/p)   # project onto Lp sphere
    budget = np.abs(X).sum(1)
    vertex = np.abs(X).max(1)
    c = np.corrcoef(budget, vertex)[0,1]
    print(f"{p:>5} {budget.min():>13.4f}..{budget.max():<13.4f} {c:>22.3f}")

print()
print("B. delta EXPONENT: xdot = -k*x*|x|^(delta-1), k=1, x0=1")
def integrate(delta, x0=1.0, dt=1e-5, tmax=6.0):
    x, t = x0, 0.0
    hit = None
    while t < tmax:
        x += -np.sign(x)*abs(x)**delta * dt
        t += dt
        if abs(x) < 1e-9 and hit is None:
            hit = t; break
    return hit, x
for d in [0.5, 0.75, 1.0, 1.5]:
    hit, xf = integrate(d)
    slope0 = "diverges" if d < 1 else ("finite" if d == 1 else "zero")
    reach = f"reaches 0 at t={hit:.3f}" if hit else f"never reaches 0 (x={xf:.2e} at t=6)"
    print(f"  delta={d:<5} force at origin -> 0 ; d|f|/d|x| at 0 {slope0:>9} ; {reach}")

print()
print("C. delta=1 CONFOUNDING: attraction -a*x plus restoration -r*x")
t = np.linspace(0, 4, 400)
truth = np.exp(-(0.7+0.3)*t)             # a=0.7, r=0.3
for a, r in [(0.7,0.3), (0.2,0.8), (1.0,0.0), (0.0,1.0)]:
    err = np.abs(np.exp(-(a+r)*t) - truth).max()
    print(f"  a={a:<4} r={r:<4} max trajectory error vs truth: {err:.2e}")
print("  -> only a+r is identifiable; any split fits identically.")
