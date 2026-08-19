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
#     # OMP-IMPA Quality Aliases:
#     precommit: [
#       "compile --warnings-as-errors",
#       "format --check-formatted",
#       "test"
#     ],
#     "impa.verify": [
#       "compile --warnings-as-errors",
#       "format --check-formatted",
#       "test"
#     ]
#   ]
# end
