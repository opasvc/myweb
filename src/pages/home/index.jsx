import { useMemo, useState } from "react";
import QRCode from "qrcode";
import "./index.css";

const templates = {
    chongqing: {
        name: "重庆模板",
        description: "健康证样式，访问码生成二维码",
        accent: "#292d99",
        title: "重庆市从业人员健康合格证明",
        fields: ["name", "idCard", "age", "gender", "accessCode", "createDate"],
        htmlUrl: `${process.env.PUBLIC_URL}/templates/重庆模板.html`
    },
    zhengzhou: {
        name: "郑州模板",
        description: "健康证卡片样式，访问码生成二维码",
        accent: "#01a6e6",
        title: "郑州市从业人员健康证明",
        fields: ["name", "idCard", "age", "gender", "accessCode", "createDate"],
        htmlUrl: `${process.env.PUBLIC_URL}/templates/郑州模板.html`
    }
};

const userValues = {
    "user.sex": "gender",
    "user.name": "name",
    "user.age": "age",
    "user.nameId": "idCard",
    "user.jkzCreateData": "createDate"
};

function getTodayValue() {
    const today = new Date();
    const timezoneOffset = today.getTimezoneOffset() * 60000;

    return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

async function createQrCodeDataUrl(value) {
    return QRCode.toDataURL(value || "未填写", {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 180,
        color: {
            dark: "#000000",
            light: "#ffffff"
        }
    });
}

function renderThText(templateText, form) {
    const normalizedText =
        templateText.startsWith("|") && templateText.endsWith("|")
            ? templateText.slice(1, -1)
            : templateText;

    return normalizedText.replace(/\$\{([^}]+)\}/g, (_, key) => {
        const formKey = userValues[key.trim()];

        return formKey ? form[formKey] || "" : "";
    });
}

function fillServerTemplateText(doc, form) {
    doc.querySelectorAll("[th\\:text]").forEach((node) => {
        const templateText = node.getAttribute("th:text");

        node.textContent = renderThText(templateText, form);
        node.removeAttribute("th:text");
    });
}

function fillServerTemplateImages(doc, avatar, qrCodeDataUrl) {
    doc.querySelectorAll("script").forEach((node) => node.remove());
    doc.querySelectorAll("#monica-content-root, .monica-widget").forEach((node) => node.remove());

    const qrImage = doc.querySelector(".qrcode-img") || doc.querySelector("#qrcode img");

    if (qrImage) {
        qrImage.setAttribute("src", qrCodeDataUrl);
        qrImage.setAttribute("alt", "访问码二维码");
        qrImage.removeAttribute("th:src");
    }

    doc.querySelectorAll("#qrcode canvas").forEach((node) => node.remove());

    const photoImage = doc.querySelector(".photo-container img") || doc.querySelector(".headimg");

    if (photoImage) {
        if (avatar) {
            photoImage.setAttribute("src", avatar);
        }

        photoImage.setAttribute("alt", "照片");
        photoImage.removeAttribute("th:src");
    }

    doc.querySelectorAll("[th\\:src]").forEach((node) => node.removeAttribute("th:src"));
}

async function buildTemplateHtml(form, avatar) {
    const template = templates[form.template];
    const response = await fetch(template.htmlUrl);

    if (!response.ok) {
        throw new Error(`${template.name}加载失败`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const qrCodeDataUrl = await createQrCodeDataUrl(form.accessCode);

    doc.title = `${form.name || "用户"}的健康证`;
    fillServerTemplateText(doc, form);
    fillServerTemplateImages(doc, avatar, qrCodeDataUrl);

    return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
}

function Home() {
    const [form, setForm] = useState({
        name: "",
        idCard: "",
        age: "",
        gender: "",
        accessCode: "",
        createDate: "",
        avatar: null,
        avatarPreview: "",
        template: "chongqing"
    });
    const [resultHtml, setResultHtml] = useState("");
    const [error, setError] = useState("");

    const selectedTemplate = templates[form.template];

    const completion = useMemo(() => {
        const values = [
            form.name,
            form.idCard,
            form.age,
            form.gender,
            form.accessCode,
            form.createDate,
            form.avatar
        ];
        const filled = values.filter(Boolean).length;

        return Math.round((filled / values.length) * 100);
    }, [form]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        setForm({
            ...form,
            [name]: value
        });
    };

    const handleUseToday = () => {
        setForm({
            ...form,
            createDate: getTodayValue()
        });
    };

    const fileToBase64 = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();

            reader.onload = () => {
                resolve(reader.result);
            };

            reader.readAsDataURL(file);
        });
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        const avatarPreview = file ? await fileToBase64(file) : "";

        setForm({
            ...form,
            avatar: file || null,
            avatarPreview
        });
    };

    const createRenderedHtml = async () => {
        const avatar = form.avatar ? await fileToBase64(form.avatar) : form.avatarPreview;

        return buildTemplateHtml(form, avatar);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            const html = await createRenderedHtml();

            setResultHtml(html);
        } catch (err) {
            setResultHtml("");
            setError(err.message || "模板生成失败");
        }
    };

    const handleOpenRenderedPage = async () => {
        setError("");

        const renderedWindow = window.open("", "_blank");

        if (!renderedWindow) {
            setError("浏览器阻止了新窗口，请允许弹窗后再试");
            return;
        }

        renderedWindow.document.write("<p style='font-family: sans-serif; padding: 20px;'>正在生成...</p>");

        try {
            const html = resultHtml || await createRenderedHtml();

            setResultHtml(html);
            renderedWindow.document.open();
            renderedWindow.document.write(html);
            renderedWindow.document.close();
        } catch (err) {
            renderedWindow.close();
            setError(err.message || "模板生成失败");
        }
    };

    return (
        <main className="home">
            <section className="hero">
                <div>
                    <p className="eyebrow">信息模板生成器</p>
                    <h1>把人员信息整理成一张清爽的登记表</h1>
                    <p className="hero-text">
                        填写资料、选择城市模板，立即生成可预览的 HTML 登记表。
                    </p>
                </div>

                <div className="status-panel" aria-label="资料完整度">
                    <span>资料完整度</span>
                    <strong>{completion}%</strong>
                    <div className="progress">
                        <i style={{ width: `${completion}%` }} />
                    </div>
                </div>
            </section>

            <section className="workspace">
                <form className="form-card" onSubmit={handleSubmit}>
                    <div className="section-heading">
                        <div>
                            <p>基础资料</p>
                            <h2>填写信息</h2>
                        </div>
                        <span>{selectedTemplate.name}</span>
                    </div>

                    <div className="form-grid">
                        <label className="form-item">
                            <span>姓名</span>
                            <input
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                placeholder="请输入姓名"
                            />
                        </label>

                        <label className="form-item">
                            <span>编号</span>
                            <input
                                name="idCard"
                                value={form.idCard}
                                onChange={handleChange}
                                placeholder="请输入编号证号"
                            />
                        </label>

                        <label className="form-item">
                            <span>年龄</span>
                            <input
                                type="number"
                                name="age"
                                value={form.age}
                                onChange={handleChange}
                                placeholder="例如 28"
                            />
                        </label>

                        <label className="form-item">
                            <span>性别</span>
                            <select name="gender" value={form.gender} onChange={handleChange}>
                                <option value="">请选择</option>
                                <option value="男">男</option>
                                <option value="女">女</option>
                            </select>
                        </label>

                        <label className="form-item">
                            <span>访问码</span>
                            <input
                                name="accessCode"
                                value={form.accessCode}
                                onChange={handleChange}
                                placeholder="请输入访问码"
                            />
                        </label>

                        <label className="form-item">
                            <span>创建日期</span>
                            <div className="date-control">
                                <input
                                    type="date"
                                    name="createDate"
                                    value={form.createDate}
                                    onChange={handleChange}
                                />
                                <button type="button" onClick={handleUseToday}>
                                    今天
                                </button>
                            </div>
                        </label>

                        <label className="form-item upload-item">
                            <span>头像</span>
                            <input type="file" accept="image/*" onChange={handleAvatarChange} />
                        </label>
                    </div>

                    <div className="template-list">
                        {Object.entries(templates).map(([key, template]) => (
                            <label
                                className={`template-option ${
                                    form.template === key ? "active" : ""
                                }`}
                                key={key}
                            >
                                <input
                                    type="radio"
                                    name="template"
                                    value={key}
                                    checked={form.template === key}
                                    onChange={handleChange}
                                />
                                <span>{template.name}</span>
                                <small>{template.description}</small>
                            </label>
                        ))}
                    </div>

                    <button className="submit-button" type="submit">
                        生成模板
                    </button>
                </form>

                <aside className="preview-card">
                    <div className="section-heading preview-heading">
                        <div>
                            <p>生成结果</p>
                            <h2>预览</h2>
                        </div>
                        <div className="preview-actions">
                            <span>{resultHtml ? "已生成" : "等待生成"}</span>
                            <button type="button" onClick={handleOpenRenderedPage}>
                                打开渲染页面
                            </button>
                        </div>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    {resultHtml ? (
                        <iframe title="preview" srcDoc={resultHtml} />
                    ) : (
                        <div className="empty-preview">
                            <div className="avatar-preview">
                                {form.avatarPreview ? (
                                    <img src={form.avatarPreview} alt="头像预览" />
                                ) : (
                                    <span>头像</span>
                                )}
                            </div>
                            <h3>{selectedTemplate.title}</h3>
                            <p>点击“生成模板”后，这里会展示完整登记表。</p>
                        </div>
                    )}
                </aside>
            </section>
        </main>
    );
}

export default Home;
