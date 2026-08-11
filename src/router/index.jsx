import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "../pages/home";

function Router() {
    return (
        <BrowserRouter basename="/myweb">
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/home" element={<Home />} />
            </Routes>
        </BrowserRouter>
    );
}

export default Router;