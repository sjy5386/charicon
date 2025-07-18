export const randomColor = () => `rgb(${Math.floor(Math.random() * 128)}, ${Math.floor(Math.random() * 128)}, ${Math.floor(Math.random() * 128)})`

export const downloadCanvas = (canvas: HTMLCanvasElement | null, filename: string) => {
    if (canvas) {
        const dataURL = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = dataURL;
        downloadLink.download = filename;
        downloadLink.click();
    } else {
        console.error("Canvas element not found.");
    }
}
