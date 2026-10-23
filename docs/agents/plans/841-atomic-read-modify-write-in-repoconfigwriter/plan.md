# Plan: Atomic read-modify-write in RepoConfigWriter

Issue: [841-atomic-read-modify-write-in-repoconfigwriter.md](../../issues/841-atomic-read-modify-write-in-repoconfigwriter.md)

## Overview
This adds `RepoConfigWriter#update`, a locked read-modify-write primitive in `shared/`, which #781's `ignore-checks add/remove` needs. The whole change belongs to one owner: see [shared.md](shared.md).
