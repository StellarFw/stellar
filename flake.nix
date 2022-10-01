{
  description = "Modern action-based web framework";
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        nodejs = pkgs.nodejs-18_x;
      in
      {
        devShell = pkgs.mkShell
          {
            NODE_ENV = "development";
            buildInputs = [
              nodejs
              pkgs.git
              pkgs.nodePackages.pnpm
            ];
          };
      });
}
