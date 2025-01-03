import React from 'react';
import './auth.css'; // استيراد ملف CSS الجديد
import { Link } from 'react-router-dom';
import { Card, Form, Input, Button } from 'reactstrap';
import Error from 'components/Error';
import Logo from 'assets/logo.png';
import Auth from 'Auth';
import axios from 'axios';

class Register extends React.Component {
  state = { name: '', username: '', password: '', error: '' };

  onChange = e => this.setState({ [e.target.name]: e.target.value, error: null });

  onSubmit = e => {
    e.preventDefault();
    let data = { name: this.state.name, username: this.state.username, password: this.state.password };
    axios.post('/api/auth/register', data)
      .then(res => {
        Auth.login(res.data);
        this.props.history.push('/');
      })
      .catch(err => this.setState({ error: err.response.data.message }));
  };

  render() {
    return (
      <div className="auth-container">
        <Form onSubmit={this.onSubmit}>
          <img src={Logo} alt="Logo" />
          <h5 className="auth-header">Create a New Account</h5>
          <Error error={this.state.error} />
          <Input className="auth-form-control" value={this.state.name} name="name" onChange={this.onChange} placeholder="Name" required />
          <Input className="auth-form-control" value={this.state.username} name="username" onChange={this.onChange} placeholder="Username" required />
          <Input type="password" className="auth-form-control" value={this.state.password} name="password" onChange={this.onChange} placeholder="Password" required />
          <Button className="auth-button" block>Create</Button>
          <small className="auth-footer">
            <Link to="/login">Login</Link>
          </small>
          <p className="auth-footer">&copy; {new Date().getFullYear()}</p>
        </Form>
      </div>
    );
  }
}

export default Register;
