# Tambahkan ke defp aliases di mix.exs proyek target:
#
# defp aliases do
#   [
#     setup: ["deps.get", "ecto.setup", "assets.setup", "assets.build"],
#     "ecto.setup": ["ecto.create", "ecto.migrate", "run priv/repo/seeds.exs"],
#     "ecto.reset": ["ecto.drop", "ecto.setup"],
#     test: ["ecto.create --quiet", "ecto.migrate --quiet", "test"],
#     "assets.setup": ["tailwind.install --if-missing", "esbuild.install --if-missing"],
#     "assets.build": ["tailwind default", "esbuild default"],
#     "assets.deploy": ["tailwind default --minify", "esbuild default --minify", "phx.digest"],
#     
#     # OMP-IMPA Fast Pre-Commit (Sub-2-Detik, tanpa menjalankan full test suite):
#     precommit: [
#       "compile --warnings-as-errors",
#       "format --check-formatted"
#     ],
#     
#     # OMP-IMPA Full Verification (Jalankan sebelum merge / /ompimpa:verify / CI):
#     "impa.verify": [
#       "compile --warnings-as-errors",
#       "format --check-formatted",
#       "test"
#     ]
#   ]
# end
