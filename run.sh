
#!/bin/bash

case "$1" in
  build)
    cargo build --release
    ;;
  test)
    cargo test
    ;;
  start)
    cargo run --release
    ;;
  lint-markdown)
    # Not implemented yet
    ;;
  *)
    echo "Usage: $0 {build|test|start|lint-markdown}"
    exit 1
    ;;
esac
