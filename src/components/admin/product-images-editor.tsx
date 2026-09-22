"use client";
import Image from "next/image";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ProductImage } from "@/lib/types";
import { getGalleryImages, productImageUrl } from "@/lib/product-utils";
import { prepareBrowserImage } from "@/lib/images/prepare";
import { IMAGE_MIME_TYPES } from "@/lib/images/validation";
import {
  productImageAction,
  type ImageActionState,
} from "@/app/admin/image-actions";
import { ProductImageView } from "@/components/product-image";

const subscribeToHydration = () => () => {};

type EditProps = {
  productId: string;
  image?: ProductImage;
  locked: boolean;
  onBusy: (busy: boolean) => void;
  onSaved: (result: ImageActionState) => void;
};
function ImageEditor({ productId, image, locked, onBusy, onSaved }: EditProps) {
  const id = useId();
  const [alt, setAlt] = useState(image?.alt_text || "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function chooseFile(selected?: File) {
    if (!selected) return;
    setError("");
    setWorking("Preparing image...");
    onBusy(true);
    try {
      const prepared = await prepareBrowserImage(selected);
      setFile(prepared);
      setPreview(URL.createObjectURL(prepared));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not prepare this image.",
      );
      if (fileInput.current) fileInput.current.value = "";
    } finally {
      setWorking("");
      onBusy(false);
    }
  }
  async function save(operation = "save", primary = false) {
    if (operation !== "remove" && !alt.trim()) {
      setError("Add a short, useful image description before saving.");
      document.getElementById(id + "-alt")?.focus();
      return;
    }
    setError("");
    setWorking(
      operation === "remove"
        ? "Removing image..."
        : file
          ? "Uploading image..."
          : "Saving image...",
    );
    onBusy(true);
    const form = new FormData();
    form.set("product_id", productId);
    form.set("image_id", image?.id || "");
    form.set("alt_text", alt);
    form.set("is_primary", primary ? "yes" : "no");
    form.set("operation", operation);
    if (operation === "remove") form.set("confirm", "yes");
    else if (file) form.set("image", file);
    try {
      const result = await productImageAction(form);
      if (result.error) setError(result.fields?.alt_text || result.error);
      else {
        dialog.current?.close();
        setFile(null);
        setPreview("");
        if (fileInput.current) fileInput.current.value = "";
        if (!image) setAlt("");
        onSaved(result);
      }
    } catch {
      setError(
        "The request could not finish. Check your connection, refresh the gallery and try again.",
      );
    } finally {
      setWorking("");
      onBusy(false);
    }
  }
  return (
    <div className="admin-image-editor" aria-busy={!!working}>
      <div className="admin-image-preview">
        {preview ? (
          <Image
            src={preview}
            alt={alt || "Selected image preview"}
            width={480}
            height={480}
            unoptimized
          />
        ) : image ? (
          <ProductImageView
            src={productImageUrl(image.image_url)}
            alt={image.alt_text || "Current product image"}
            width={480}
            height={480}
            sizes="(max-width: 760px) 90vw, 330px"
          />
        ) : (
          <p className="admin-help">Choose a photo to preview it here.</p>
        )}
        {image?.is_primary && (
          <span className="admin-image-cover">Cover image</span>
        )}
      </div>
      <label htmlFor={id + "-file"}>
        {image ? "Replace image" : "Add an image"}
        <input
          id={id + "-file"}
          ref={fileInput}
          type="file"
          accept={IMAGE_MIME_TYPES.join(",")}
          disabled={locked}
          onChange={(event) => void chooseFile(event.target.files?.[0])}
          aria-describedby={id + "-help"}
        />
      </label>
      <p id={id + "-help"} className="admin-help">
        JPEG, PNG, WebP or AVIF, up to 5 MB. Photos are resized for the
        storefront.
      </p>
      <label htmlFor={id + "-alt"}>
        Image description (alt text)
        <input
          id={id + "-alt"}
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          maxLength={300}
          disabled={locked}
          placeholder="Black denim jacket with a silver painted rose"
        />
      </label>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {working && (
        <p className="admin-image-progress" role="status">
          {working}
        </p>
      )}
      {preview && (
        <p className="admin-help">
          Preview ready. Select {image ? "Save image" : "Upload image"} to
          publish this photo.
        </p>
      )}
      <div className="admin-image-actions">
        <button
          type="button"
          className="admin-button"
          onClick={() => void save()}
          disabled={locked || (!image && !file)}
        >
          {image ? "Save image" : "Upload image"}
        </button>
        {file && (
          <button
            type="button"
            className="admin-text-button"
            disabled={locked}
            onClick={() => {
              setFile(null);
              setPreview("");
              if (fileInput.current) fileInput.current.value = "";
            }}
          >
            Cancel selection
          </button>
        )}
        {image && (
          <>
            {!image.is_primary && (
              <button
                type="button"
                className="admin-text-button"
                disabled={locked}
                onClick={() => void save("save", true)}
              >
                Make cover
              </button>
            )}
            <button
              type="button"
              className="admin-text-button is-danger"
              disabled={locked}
              onClick={() => dialog.current?.showModal()}
            >
              Remove image
            </button>
            <dialog
              ref={dialog}
              className="admin-dialog"
              aria-labelledby={id + "-remove-title"}
              onCancel={(event) => {
                if (working) event.preventDefault();
              }}
            >
              <h2 id={id + "-remove-title"}>REMOVE IMAGE?</h2>
              <p>
                This removes the photo from this product. A photo shared by
                another product will be kept.
              </p>
              <div className="admin-form-actions">
                <button
                  type="button"
                  autoFocus
                  className="admin-button admin-button-secondary"
                  disabled={locked}
                  onClick={() => dialog.current?.close()}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-button admin-button-danger"
                  disabled={locked}
                  onClick={() => void save("remove")}
                >
                  {working ? "Removing..." : "Confirm removal"}
                </button>
              </div>
              {error && (
                <p className="admin-error" role="alert">
                  {error}
                </p>
              )}
            </dialog>
          </>
        )}
      </div>
    </div>
  );
}

export function ProductImagesEditor({
  productId,
  initialImages,
  onBusy,
}: {
  productId: string;
  initialImages: ProductImage[];
  onBusy: (busy: boolean) => void;
}) {
  // File change events cannot be replayed before the editor is hydrated.
  const ready = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [images, setImages] = useState(initialImages);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  function saved(result: ImageActionState) {
    if (result.images) setImages(result.images);
    setMessage(result.message || "Image saved.");
  }
  function lock(next: boolean) {
    setBusy(next);
    onBusy(next);
  }
  return (
    <div className="admin-images-editor">
      <p className="admin-help">
        Image changes save separately from product details. The cover appears on
        product cards. Up to 12 images.
      </p>
      {message && (
        <p className="admin-success" role="status">
          {message}
        </p>
      )}
      {getGalleryImages(images).map((image) => (
        <ImageEditor
          key={image.id + image.image_url + image.alt_text + image.is_primary}
          productId={productId}
          image={image}
          locked={busy || !ready}
          onBusy={lock}
          onSaved={saved}
        />
      ))}
      {images.length < 12 && (
        <ImageEditor
          productId={productId}
          locked={busy || !ready}
          onBusy={lock}
          onSaved={saved}
        />
      )}
    </div>
  );
}
