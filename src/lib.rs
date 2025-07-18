
use axum::extract::ConnectInfo;
use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
    Router,
};
use std::net::SocketAddr;
use tower_http::services::ServeDir;

pub fn app() -> Router {
    Router::new()
        .nest_service("/", ServeDir::new("."))
        .route("/ws", get(ws_handler))
}

pub async fn run() {
    let addr = "127.0.0.1:8080".parse::<SocketAddr>().unwrap();
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("Listening on: http://{}", addr);
    axum::serve(listener, app().into_make_service_with_connect_info::<SocketAddr>()).await.unwrap();
}

async fn ws_handler(ws: WebSocketUpgrade, ConnectInfo(addr): ConnectInfo<SocketAddr>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, addr))
}

async fn handle_socket(mut socket: WebSocket, who: SocketAddr) {
    println!("New WebSocket connection from: {}", who);

    // Send the client its IP address
    if socket.send(Message::Text(format!("Your IP is: {}", who))).await.is_err() {
        return; // Client disconnected
    }

    if let Some(Ok(msg)) = socket.recv().await {
        match msg {
            Message::Text(text) => {
                if text == "download" {
                    let data = vec![0; 1024 * 1024]; // 1MB chunk
                    loop {
                        if socket.send(Message::Binary(data.clone())).await.is_err() {
                            break;
                        }
                    }
                } else if text == "upload" {
                    while socket.recv().await.is_some() {}
                }
            }
            _ => (),
        }
    }
}
