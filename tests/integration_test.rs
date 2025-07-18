use futures_util::{SinkExt, StreamExt};
use speedtest::app;
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::protocol::Message;

async fn start_server() -> (SocketAddr, oneshot::Sender<()>) {
    let app = app();
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let (tx, rx) = oneshot::channel::<()>();

    let server = axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).with_graceful_shutdown(async {
        rx.await.ok();
    });

    tokio::spawn(async move {
        server.await.unwrap();
    });

    (addr, tx)
}

#[tokio::test]
async fn test_download() {
    let (addr, shutdown_tx) = start_server().await;
    let (ws_stream, _) = connect_async(format!("ws://{}/ws", addr)).await.unwrap();
    let (mut write, mut read) = ws_stream.split();

    // Read the initial IP address message and ignore it
    let _ip_msg = read.next().await.unwrap().unwrap();

    write.send(Message::Text("download".to_string())).await.unwrap();

    let msg = read.next().await.unwrap().unwrap();
    assert!(matches!(msg, Message::Binary(_)));

    // Shutdown the server
    let _ = shutdown_tx.send(());
}

#[tokio::test]
async fn test_upload() {
    let (addr, shutdown_tx) = start_server().await;
    let (ws_stream, _) = connect_async(format!("ws://{}/ws", addr)).await.unwrap();
    let (mut write, _read) = ws_stream.split();

    write.send(Message::Text("upload".to_string())).await.unwrap();

    let data = vec![0; 1024];
    write.send(Message::Binary(data)).await.unwrap();

    // Shutdown the server
    let _ = shutdown_tx.send(());
}