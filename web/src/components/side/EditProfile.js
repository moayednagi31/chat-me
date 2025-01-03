import React from "react";
import { Row, Form, Input, Button } from "reactstrap";
import Error from "components/Error";
import Avatar from "components/Avatar";
import axios from "axios";

/**
 * EditProfile Component.
 */
class EditProfile extends React.Component {
  constructor(props) {
    super(props);

    // Provide a safe fallback if props.user is null/undefined
    const user = props.user || {};

    this.state = {
      name: user.name || "",
      about: user.about || "",
      image: null,
      avatar: null,
      error: null
    };

    this.fileUpload = React.createRef();
  }

  /**
   * Trigger click on file upload input.
   */
  showFileUpload = () => this.fileUpload.current.click();

  /**
   * If avatar input changed then change the preview.
   */
  onImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      this.setState({
        image: URL.createObjectURL(e.target.files[0]),
        avatar: e.target.files[0]
      });
    }
  };

  /**
   * Change form handler.
   */
  onChange = (e) => this.setState({ [e.target.name]: e.target.value, error: null });

  /**
   * Form submit handler.
   */
  onSubmit = (e) => {
    e.preventDefault();
    const data = new FormData();
    data.append("name", this.state.name);
    data.append("about", this.state.about);
    if (this.state.avatar) {
      data.append("avatar", this.state.avatar, this.state.avatar.name);
    }
    axios
      .post("/api/account", data)
      .then(this.props.toggle)
      .catch((err) => {
        this.setState({
          error: err.response?.data?.message || "An error occurred."
        });
      });
  };

  /**
   * When closing sidebar.
   */
  onClose = () => {
    // If props.user might still be null, handle that safely:
    const user = this.props.user || {};
    this.setState({
      image: null,
      avatar: null,
      name: user.name || "",
      about: user.about || ""
    });
    this.props.toggle();
  };

  /**
   * Render component.
   */
  render() {
    return (
      <div className={this.props.open ? "side-profile open" : "side-profile"}>
        <Row className="heading">
          <div className="mr-2 nav-link" onClick={this.onClose}>
            <i className="fa fa-arrow-right" />
          </div>
          <div>Profile</div>
        </Row>

        <div className="d-flex flex-column" style={{ overflow: "auto" }}>
          <Form onSubmit={this.onSubmit}>
            <Error error={this.state.error} />

            {/* Avatar preview + image upload */}
            <div className="text-center" onClick={this.showFileUpload}>
              <Avatar
                // If props.user might be null, use optional chaining here:
                src={this.props.user?.avatar}
                file={this.state.image}
              />
            </div>

            <input
              type="file"
              ref={this.fileUpload}
              onChange={this.onImageChange}
              className="d-none"
            />

            {/* Name field */}
            <div className="bg-white px-4 py-2">
              <label className="text-muted">Name</label>
              <Input
                value={this.state.name}
                name="name"
                onChange={this.onChange}
                required
                autoComplete="off"
              />
            </div>

            {/* About field */}
            <div className="bg-white px-3 py-2">
              <label className="text-muted">Status Message</label>
              <Input
                value={this.state.about}
                name="about"
                onChange={this.onChange}
                required
                autoComplete="off"
              />
            </div>

            {/* Submit button */}
            <div className="bg-white px-3 py-2">
              <Button block className="mt-3">
                Save
              </Button>
            </div>
          </Form>
        </div>
      </div>
    );
  }
}

export default EditProfile;
