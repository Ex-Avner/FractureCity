# 072 — version truth

Not applied. One line.

◆

## The discrepancy

The builder emits `v0.32.0` while `fracture.app.json` says `0.33.0`. I caused
this: after the HD pass I bumped the manifest and left the game's own constant
alone.

## Which label is authoritative: `SH_VERSION`

It has three consumers. `fracture.app.json` has one.

| Reader | Reads |
|---|---|
| `_build/build-beta.py:159` | `SH_VERSION` out of the game file |
| `_build/build-beta.py:269` | names the zip from it |
| section 62's release gate | stamps every heading that looks like a version from it at boot |
| the launcher grid | `fracture.app.json` |

So the deployed build, the archive name and every version string the player
sees all come from `SH_VERSION`, and the manifest is a label on a tile. The
manifest should follow the constant, never the other way round.

This is the same failure section 62 was written to stop. Its comment says it
outright: "Hand-patching one element per release is how a version string goes
stale in the first place." I then hand-patched one element.

## The fix

`SH_VERSION` goes to `0.33.0`, matching the manifest, because the HD pass and
the fittings work were real releases. One line:

```
git apply _patches/072-version-truth.patch
```

Apply after `071` if you are applying both. The two edits are 23,000 lines
apart, so `git apply` resolves the offset either way.

## The check that stops it recurring

`_test/webbuild.js` now reads `SH_VERSION` from the game file and asserts the
manifest version and the built zip name agree with it. Against the tree as it
stands today it fails exactly as it should:

```
PASS  SH_VERSION found                     0.32.0
FAIL  manifest version matches SH_VERSION  got "0.33.0", want "0.32.0"
PASS  zip is named for SH_VERSION          fracture-city-beta-v0.32.0.zip
```

After this patch, all three agree and the check passes. It will fail again the
next time one of them is bumped alone, which is the point.
