"""Two further checks against the Formal Dynamics white paper, same sign
convention as the paper (outward pole attraction, inward centroid restoration).

    dp_i = [ a_i*sign(p_i)*|p_i|^d_i  -  k_i*(p_i - mu_i)  +  SUM_j g_ij * p_j ] dt
"""
import numpy as np

def step(p, a, k, mu, d, G, dt):
    attr = a * np.sign(p) * np.abs(p)**d
    rest = -k * (p - mu)
    coup = G @ p
    return p + (attr + rest + coup) * dt

def run(p0, a, k, mu, d, G, dt=1e-4, T=60.0, blow=50.0):
    p = np.array(p0, float)
    for _ in range(int(T/dt)):
        p = step(p, a, k, mu, d, G, dt)
        if not np.all(np.isfinite(p)) or np.max(np.abs(p)) > blow:
            return 'escaped', p
    return ('centre' if np.max(np.abs(p)) < 1e-6 else 'settled'), p

z3 = np.zeros((3,3))
one = np.ones(3)

print("A. SECTION 6.2 CAPTURE RADIUS  r* = (alpha/kappa)^(1/(1-delta)), mu=0")
print("   the paper reads r* as a capture threshold. that reading holds only for delta>1.")
for d, a, k in [(1.5, 1.0, 2.0), (0.5, 1.0, 2.0)]:
    r = (a/k)**(1/(1-d))
    for start, tag in [(r*0.6, 'inside r*'), (r*1.4, 'outside r*')]:
        end, p = run([start,0,0], a*one, k*one, 0*one, d*one, z3)
        print(f"   delta={d}  r*={r:6.3f}  start {tag:10} ({start:6.3f}) -> {end:8} |p|={abs(p[0]):.4f}")
print("   delta>1: r* is the escape threshold (capture reading correct).")
print("   delta<1: r* is an ATTRACTOR reached from both sides. not capture, a stable partial orientation.")

print()
print("B. THEOREM 1 vs CROSS-AXIS COUPLING (section 4.4, g_j(p) = p_j)")
print("   Theorem 1: centre stable iff delta>1, or delta=1 and alpha<kappa. Per axis.")
a = np.array([0.9, 0.9, 0.0]); k = np.array([1.0, 1.0, 1.0]); d = np.ones(3)
print(f"   alpha-kappa per axis = {(a-k)[:2]}  -> every axis satisfies Theorem 1 (alpha<kappa)")
for g in [0.0, 0.05, 0.5]:
    G = np.array([[0,g,0],[g,0,0],[0,0,0]], float)
    J = np.diag(a-k) + G
    ev = np.linalg.eigvals(J).real
    end, p = run([1e-4,1e-4,0], a, k, 0*one, d, G)
    print(f"   gamma_VH=gamma_HV={g:<5} eigenvalues {np.round(ev,3)}  max={ev.max():+.3f}  -> {end:8} |p|max={np.max(np.abs(p)):.4f}")
print("   coupling of 0.5 destabilises a centre that every per-axis test calls stable.")
print("   Theorem 1 is an 'iff' only when Gamma = 0.")

print()
print("C. SAME, WITH delta>1 (attraction vanishes at the origin, so J = -K + Gamma)")
a = np.array([1.0,1.0,0.0]); k = np.array([0.4,0.4,1.0]); d = np.array([1.5,1.5,1.5])
for g in [0.0, 0.5]:
    G = np.array([[0,g,0],[g,0,0],[0,0,0]], float)
    ev = np.linalg.eigvals(np.diag(-k) + G).real
    end, p = run([1e-4,1e-4,0], a, k, 0*one, d, G)
    print(f"   gamma={g:<4} eigenvalues {np.round(ev,3)}  -> {end:8} |p|max={np.max(np.abs(p)):.4f}")
print("   delta>1 alone does not guarantee a stable centre either: it needs Gamma small vs K.")
