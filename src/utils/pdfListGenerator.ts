import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateArchiveListPDF = async (
    userFullName: string,
    startDate: string,
    endDate: string
) => {
    try {
        // 1. Get the archive table from the DOM
        const tableEl = document.getElementById('archive-table');
        if (!tableEl) throw new Error('لم يتم العثور على الجدول');

        // 2. Create a hidden container with the full print layout
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: -9999px;
            left: 0;
            width: 750px;
            background: white;
            padding: 30px;
            direction: rtl;
            font-family: 'Amiri', 'Cairo', 'Segoe UI', Tahoma, serif;
            color: black;
        `;

        // Format dates
        const formattedStart = startDate ? startDate.split('-').reverse().join('-') : 'البداية';
        const formattedEnd = endDate ? endDate.split('-').reverse().join('-') : 'النهاية';
        const printDate = new Date().toLocaleDateString('en-GB');

        // 3. Build the header HTML
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 20px;">
                <!-- Right Side: Directorate Info -->
                <div style="text-align: right; flex: 1;">
                    <div style="font-size: 22px; font-weight: bold; margin-bottom: 4px; white-space: nowrap;">مديرية اتصالات ومعلوماتية</div>
                    <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px;">كربلاء المقدسة</div>
                    <div style="font-size: 14px; font-weight: bold; color: #444;">تطبيق الادارة الموحد</div>
                </div>
                <!-- Center: Logo -->
                <div style="flex: 1; display: flex; justify-content: center; align-items: center;">
                    <img src="/icon-192.png" alt="شعار التطبيق" style="width: 85px; height: 85px; object-fit: contain;" crossorigin="anonymous" />
                </div>
                <!-- Left Side: Print Date -->
                <div style="flex: 1; text-align: left;">
                    <div style="font-size: 12px; font-weight: bold; color: #555; white-space: nowrap;">تاريخ الطباعة: ${printDate}</div>
                </div>
            </div>

            <!-- Title -->
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="font-size: 26px; font-weight: bold; margin-bottom: 10px;">قائمة إجازات الموظف</div>
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">الاسم: ${userFullName}</div>
                <div style="font-size: 14px; font-weight: bold; color: #333;">للفترة من ${formattedStart} إلى ${formattedEnd}</div>
            </div>

            <!-- Table will be cloned here -->
            <div id="pdf-table-container"></div>
        `;

        document.body.appendChild(container);

        // 4. Clone the existing table into the container
        const tableClone = tableEl.cloneNode(true) as HTMLElement;
        tableClone.removeAttribute('id'); // Prevent duplicate IDs
        // Style the clone for print
        tableClone.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
            text-align: center;
            direction: rtl;
            color: black;
            table-layout: fixed;
        `;
        // Style all cells
        const allCells = tableClone.querySelectorAll('th, td');
        allCells.forEach((cell: Element) => {
            (cell as HTMLElement).style.cssText = `
                border: 2px solid black;
                padding: 8px 6px;
                text-align: center;
                font-weight: bold;
                color: black;
                background: white;
                white-space: nowrap;
            `;
        });
        // Style header cells
        const headerCells = tableClone.querySelectorAll('th');
        headerCells.forEach((cell: Element) => {
            (cell as HTMLElement).style.cssText += `
                background: #e8e8e8;
                font-size: 13px;
            `;
        });

        const tableContainer = container.querySelector('#pdf-table-container');
        if (tableContainer) {
            tableContainer.appendChild(tableClone);
        }

        // 5. Capture the container as a canvas image
        const canvas = await html2canvas(container, {
            scale: 2, // High resolution
            useCORS: true, // Allow cross-origin images (logo)
            backgroundColor: '#ffffff',
            logging: false,
        });

        // 6. Remove the hidden container
        document.body.removeChild(container);

        // 7. Create the PDF and add the image
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm

        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Add the image, with margins
        const margin = 10; // 10mm margin
        const contentWidth = imgWidth - (margin * 2);
        const contentHeight = (canvas.height * contentWidth) / canvas.width;

        if (contentHeight <= pageHeight - (margin * 2)) {
            // Fits on one page
            doc.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
        } else {
            // Multi-page support
            let remainingHeight = contentHeight;
            let position = margin;
            let page = 0;

            while (remainingHeight > 0) {
                if (page > 0) {
                    doc.addPage();
                }
                doc.addImage(imgData, 'PNG', margin, position - (page * (pageHeight - margin * 2)), contentWidth, contentHeight);
                remainingHeight -= (pageHeight - margin * 2);
                page++;
            }
        }

        // 8. Output PDF
        return doc.output('bloburl');

    } catch (error: any) {
        console.error("خطأ مفصل في توليد القائمة:", error);
        alert(`حدث خطأ أثناء إنشاء ملف PDF: ${error.message}`);
        throw error;
    }
};
