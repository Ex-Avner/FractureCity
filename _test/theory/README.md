# theory — reproducible checks against the Formal Dynamics white paper

Three standalone scripts. `python3 <file>`; numpy is the only dependency. They
check the manuscript's own equations in the manuscript's own sign convention.

◆

- **`totdyn.py`** — the centred scalar model
  `xdot = alpha*x*|x|^(delta-1) - kappa*x`, the paper's convention (outward pole
  attraction, inward restoration). Verifies Theorem 1, locates the interior
  equilibrium, and shows that at delta=1 only `alpha-kappa` is identifiable
  while at delta != 1 the equilibrium radius identifies `alpha/kappa`.

- **`totdyn2.py`** — two checks the scalar model cannot see. First, the section
  6.2 capture radius is an escape threshold only when delta>1; when delta<1 the
  same radius is an attractor reached from both sides. Second, Theorem 1's
  per-axis condition is an "if and only if" only when cross-axis coupling
  (section 4.4) is zero: gamma = 0.5 destabilises a centre that every per-axis
  test calls stable.

- **`totmath.py`** — geometry only, no dynamics. On the L1 sphere that the
  octahedral budget axiom (section 3.3) defines, the budget `sum|p|` is
  identically 1, so it cannot distinguish a vertex from a face centre. Written
  before the manuscript was located; kept because the geometric result stands,
  but note that its section C used an inward-attraction model and does not
  describe the paper's dynamics. `totdyn.py` supersedes that part.

These live here rather than next to the manuscript because this repository is
the shared workspace. Move them when there is a better home.
