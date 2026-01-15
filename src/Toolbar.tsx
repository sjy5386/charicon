import * as React from "react";

export interface ToolbarProps {
    font: string;
    setFont: React.Dispatch<React.SetStateAction<string>>;
    fontSize: number;
    setFontSize: React.Dispatch<React.SetStateAction<number>>;
    fonts: Array<string>;
}

const Toolbar = ({
                     font,
                     setFont,
                     fontSize,
                     setFontSize,
                     fonts,
                 }: ToolbarProps) => {
    return (
        <div className="header-container">
            <div className="input-item">
                <label>글꼴</label>
                <select value={font} onChange={(e) => setFont(e.target.value)}>
                    {fonts.map((font, index) => (
                        <option key={index} value={font}>
                            {font}
                        </option>
                    ))}
                </select>
            </div>
            <div className="input-item">
                <label>크기</label>
                <input type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}
                       min={0} max={200}/>
            </div>
        </div>
    );
};

export default Toolbar;
